const minimum = { major: 20, minor: 11, patch: 0 };
const [major = 0, minor = 0, patch = 0] = process.versions.node.split(".").map((part) => Number.parseInt(part, 10));

const isSupported =
  major > minimum.major ||
  (major === minimum.major && (minor > minimum.minor || (minor === minimum.minor && patch >= minimum.patch)));

if (!isSupported) {
  console.error(
    `Invoice App requires Node.js >= ${minimum.major}.${minimum.minor}.${minimum.patch}. Current runtime is ${process.versions.node}. ` +
      "In Hostinger, set the Node.js app/runtime version to Node 20 LTS or newer, then rebuild/restart the app."
  );
  process.exit(1);
}
