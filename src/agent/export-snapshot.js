import { LocalCodexAdapter } from "./local-codex-adapter.js";

async function main() {
  const adapter = new LocalCodexAdapter();
  const snapshot = await adapter.fetchSnapshot();
  const recentEvents = await adapter.fetchRecentEvents({ limit: 20 });

  process.stdout.write(
    JSON.stringify(
      {
        snapshot,
        recentEvents
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

