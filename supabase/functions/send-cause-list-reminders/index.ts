// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

type ProfileReminderRow = {
  id: string;
  expo_push_token: string | null;
};

type CaseRow = {
  id: string;
  case_title: string | null;
  petitioner_name: string | null;
  respondent_name: string | null;
  next_hearing_date: string | null;
};

const REMINDER_TYPE = "cause_list_tomorrow";
const COURT_REMINDER_HOUR = 20; // 8 PM local time
const APP_TIMEZONE = "Asia/Karachi";

function getEnv(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

function getDateInTimezone(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(date);
}

function getHourInTimezone(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    hour12: false,
  });
  return Number.parseInt(formatter.format(date), 10);
}

function addDays(date: Date, days: number) {
  const clone = new Date(date);
  clone.setUTCDate(clone.getUTCDate() + days);
  return clone;
}

function getCaseDisplayTitle(row: CaseRow) {
  if (row.case_title?.trim()) return row.case_title.trim();
  const petitioner = row.petitioner_name?.trim() || "Petitioner";
  const respondent = row.respondent_name?.trim() || "Respondent";
  return `${petitioner} vs. ${respondent}`;
}

function buildNotificationBody(cases: CaseRow[]) {
  if (cases.length === 1) {
    return `You have 1 case tomorrow: ${getCaseDisplayTitle(cases[0])}`;
  }
  return `You have ${cases.length} cases tomorrow. Tap to view your cause list.`;
}

async function sendPush(token: string, title: string, body: string, date: string) {
  const response = await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Accept-encoding": "gzip, deflate",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      to: token,
      title,
      body,
      sound: "default",
      data: {
        screen: "calendar",
        date,
      },
    }),
  });

  const json = await response.json();
  return { ok: response.ok, status: response.status, json };
}

Deno.serve(async (req) => {
  try {
    const cronSecret = Deno.env.get("CAUSE_LIST_CRON_SECRET");
    if (cronSecret) {
      const incomingSecret = req.headers.get("x-cron-secret");
      if (incomingSecret !== cronSecret) {
        return new Response(
          JSON.stringify({ error: "Unauthorized cron request" }),
          { status: 401, headers: { "Content-Type": "application/json" } },
        );
      }
    }

    const supabaseUrl = getEnv("SUPABASE_URL");
    const serviceRoleKey = getEnv("SUPABASE_SERVICE_ROLE_KEY");
    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const requestText = await req.text();
    let forceSend = req.headers.get("x-force-send") === "true";
    if (requestText) {
      try {
        const parsed = JSON.parse(requestText);
        if (parsed?.force === true) forceSend = true;
      } catch {
        // Ignore malformed body and keep default behavior.
      }
    }

    const now = new Date();
    const { data: profiles, error: profileError } = await supabase
      .from("profiles")
      .select("id, expo_push_token")
      .not("expo_push_token", "is", null);

    if (profileError) {
      throw new Error(`Failed to fetch profiles: ${profileError.message}`);
    }

    const rows = (profiles || []) as ProfileReminderRow[];
    const summary = {
      forced: forceSend,
      totalProfiles: rows.length,
      matchedWindow: 0,
      sent: 0,
      skippedNoCases: 0,
      skippedAlreadySent: 0,
      failed: 0,
    };

    for (const profile of rows) {
      const localHour = getHourInTimezone(now, APP_TIMEZONE);
      if (!forceSend && localHour !== COURT_REMINDER_HOUR) continue;
      summary.matchedWindow += 1;

      const tomorrowDate = getDateInTimezone(addDays(now, 1), APP_TIMEZONE);
      const { data: existingLog } = await supabase
        .from("notification_log")
        .select("id")
        .eq("user_id", profile.id)
        .eq("notification_type", REMINDER_TYPE)
        .eq("target_date", tomorrowDate)
        .maybeSingle();

      if (existingLog?.id) {
        summary.skippedAlreadySent += 1;
        continue;
      }

      const { data: cases, error: casesError } = await supabase
        .from("cases")
        .select(
          "id, case_title, petitioner_name, respondent_name, next_hearing_date",
        )
        .eq("user_id", profile.id)
        .eq("next_hearing_date", tomorrowDate);

      if (casesError) {
        summary.failed += 1;
        await supabase.from("notification_log").insert({
          user_id: profile.id,
          notification_type: REMINDER_TYPE,
          target_date: tomorrowDate,
          status: "failed",
          error_message: casesError.message,
        });
        continue;
      }

      const tomorrowCases = (cases || []) as CaseRow[];
      if (!tomorrowCases.length) {
        summary.skippedNoCases += 1;
        continue;
      }

      const title = "Tomorrow's Cause List";
      const body = buildNotificationBody(tomorrowCases);
      const pushResult = await sendPush(
        profile.expo_push_token!,
        title,
        body,
        tomorrowDate,
      );

      if (!pushResult.ok) {
        summary.failed += 1;
        await supabase.from("notification_log").insert({
          user_id: profile.id,
          notification_type: REMINDER_TYPE,
          target_date: tomorrowDate,
          status: "failed",
          error_message: `Expo push API failed (${pushResult.status})`,
          payload: pushResult.json,
        });
        continue;
      }

      summary.sent += 1;
      await supabase.from("notification_log").insert({
        user_id: profile.id,
        notification_type: REMINDER_TYPE,
        target_date: tomorrowDate,
        status: "sent",
        payload: {
          total_cases: tomorrowCases.length,
          first_case: getCaseDisplayTitle(tomorrowCases[0]),
          expo_response: pushResult.json,
        },
      });
    }

    return new Response(JSON.stringify(summary), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
});
