/** Restores $KARTLY_DATA_DIR/db.json from data/seed.json. */
import fs from "fs";
import path from "path";

const root = process.cwd();
const seed = path.join(root, "data", "seed.json");
const liveDir = path.resolve(root, process.env.KARTLY_DATA_DIR || "./data");
const live = path.join(liveDir, "db.json");

if (!fs.existsSync(seed)) {
  process.stderr.write(`[reset] ${seed} not found. Run "npm run seed" first.\n`);
  process.exit(1);
}
fs.mkdirSync(liveDir, { recursive: true });
fs.copyFileSync(seed, `${live}.tmp`);
fs.renameSync(`${live}.tmp`, live);
process.stdout.write(`[reset] restored ${live} from data/seed.json\n`);
