import { SyncEngine } from "./sync-engine.js";
import { SupabaseRestSyncSink } from "./supabase-sink.js";

async function main() {
  const sink = new SupabaseRestSyncSink({
    baseUrl: process.env.SUPABASE_URL,
    apiKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_ANON_KEY
  });

  const engine = new SyncEngine({ sink });
  const { result } = await engine.syncOnce();

  console.log(
    `Synced workspace to Supabase (${result.syncedTables.length} tables): ${result.syncedTables.join(", ")}`
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
