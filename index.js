require("dotenv").config();

const express = require("express");
const axios = require("axios");

const app = express();

app.use(express.json({ limit: "2mb" }));

const PORT = process.env.PORT || 3000;

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

let PROJECT_ROUTES = {};

function slugify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/_/g, "-")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function parseProjectThreads(value) {
  if (!value) {
    return {};
  }

  let items;

  try {
    items = JSON.parse(value);
  } catch (error) {
    throw new Error(`PROJECT_THREADS must be valid JSON: ${error.message}`);
  }

  if (!Array.isArray(items)) {
    throw new Error("PROJECT_THREADS must be a JSON array");
  }

  return items.reduce((routes, item, index) => {
    const displayProject = slugify(item?.project);
    const projects = [item?.project, ...(Array.isArray(item?.aliases) ? item.aliases : [])];
    const threadId = item?.threadId;

    if (projects.every((project) => !slugify(project))) {
      throw new Error(`PROJECT_THREADS[${index}].project is required`);
    }

    if (!threadId || Number.isNaN(Number(threadId))) {
      throw new Error(`PROJECT_THREADS[${index}].threadId must be a number`);
    }

    projects.forEach((project) => {
      const slug = slugify(project);

      if (slug) {
        routes[slug] = {
          project: displayProject,
          threadId: Number(threadId),
        };
      }
    });

    return routes;
  }, {});
}

function validateConfig() {
  const missing = [];

  if (!TELEGRAM_BOT_TOKEN) {
    missing.push("TELEGRAM_BOT_TOKEN");
  }

  if (!TELEGRAM_CHAT_ID) {
    missing.push("TELEGRAM_CHAT_ID");
  }

  if (missing.length > 0) {
    throw new Error(`Missing required env variables: ${missing.join(", ")}`);
  }
}

function detectProject(payload) {
  const project =
    payload?.project_slug ||
    payload?.project_name ||
    payload?.data?.project_slug ||
    payload?.data?.project_name ||
    payload?.data?.issue?.project_slug ||
    payload?.data?.issue?.project_name ||
    payload?.data?.issue?.project?.slug ||
    payload?.data?.issue?.project?.name ||
    payload?.data?.event?.project_slug ||
    payload?.data?.event?.project_name ||
    payload?.data?.event?.project ||
    payload?.event?.project_slug ||
    payload?.event?.project_name ||
    payload?.event?.project ||
    payload?.project ||
    "unknown";

  return slugify(project);
}

function getProjectRoute(project) {
  return (
    PROJECT_ROUTES[project] || {
      project,
      threadId: process.env.DEFAULT_THREAD_ID,
    }
  );
}

function buildTelegramMessage(payload, project) {
  const title =
    payload?.data?.issue?.title ||
    payload?.data?.event?.title ||
    payload?.event?.title ||
    payload?.title ||
    "Unknown error";

  const level =
    payload?.data?.event?.level ||
    payload?.event?.level ||
    payload?.level ||
    "error";

  const environment =
    payload?.data?.event?.environment ||
    payload?.event?.environment ||
    payload?.environment ||
    "unknown";

  const url =
    payload?.data?.issue?.web_url ||
    payload?.data?.event?.web_url ||
    payload?.event?.web_url ||
    payload?.url ||
    null;

  let text = "";

  text += "<b>Sentry Alert</b>\n\n";
  text += `<b>Project:</b> ${escapeHtml(project)}\n`;
  text += `<b>Level:</b> ${escapeHtml(level)}\n`;
  text += `<b>Environment:</b> ${escapeHtml(environment)}\n`;
  text += `<b>Error:</b> ${escapeHtml(title)}\n`;

  if (url) {
    text += `\n<a href="${escapeHtml(url)}">Open in Sentry</a>`;
  }

  return text;
}

async function sendTelegramMessage({ threadId, text }) {
  const telegramUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
  const body = {
    chat_id: TELEGRAM_CHAT_ID,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
  };

  if (threadId) {
    body.message_thread_id = Number(threadId);
  }

  const response = await axios.post(telegramUrl, body, {
    timeout: 5000,
  });

  return response.data;
}

app.get("/", (req, res) => {
  res.json({
    ok: true,
    service: "sentry-telegram-router",
  });
});

app.post("/sentry/telegram-alert", async (req, res) => {
  try {
    const payload = req.body;

    const detectedProject = detectProject(payload);
    const projectRoute = getProjectRoute(detectedProject);
    const project = projectRoute.project;
    const threadId = projectRoute.threadId;
    const text = buildTelegramMessage(payload, project);

    console.log(
      `Received Sentry webhook: detectedProject=${detectedProject}, project=${project}, threadId=${threadId || "none"}`
    );

    await sendTelegramMessage({
      threadId,
      text,
    });

    res.json({
      ok: true,
      project,
      thread_id: threadId || null,
    });
  } catch (error) {
    console.error("Webhook error:", error?.response?.data || error.message);

    res.status(500).json({
      ok: false,
      error: error?.response?.data || error.message,
    });
  }
});

try {
  PROJECT_ROUTES = parseProjectThreads(process.env.PROJECT_THREADS);
  validateConfig();

  app.listen(PORT, () => {
    console.log(`Sentry Telegram router started on port ${PORT}`);
  });
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
