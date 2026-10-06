export default {
  async scheduled(controller, env, ctx) {
    console.log("Cron triggered:", controller.cron);

    const response = await fetch(
      "https://api.github.com/repos/Saqib-Ahmad/naukri-resume-auto/actions/workflows/naukri-update.yml/dispatches",
      {
        method: "POST",

        headers: {
          "Accept": "application/vnd.github+json",
          "Authorization": `Bearer ${env.GITHUB_TOKEN}`,
          "X-GitHub-Api-Version": "2026-03-10",
          "Content-Type": "application/json",
          "User-Agent": "Cloudflare-Naukri-Scheduler"
        },

        body: JSON.stringify({
          ref: "main"
        })
      }
    );

    if (!response.ok) {
      const errorText = await response.text();

      console.error(
        "GitHub workflow dispatch failed:",
        response.status,
        errorText
      );

      throw new Error(
        `GitHub workflow dispatch failed: ${response.status}`
      );
    }

    console.log("GitHub Naukri workflow triggered successfully.");
  }
};