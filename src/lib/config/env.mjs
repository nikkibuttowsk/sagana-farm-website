export class ServerConfigurationError extends Error {
  constructor(message) {
    super(message);
    this.name = "ServerConfigurationError";
  }
}

export function requireServerEnv(names, env = process.env) {
  const missing = names.filter((name) => !env[name]?.trim());

  if (missing.length > 0) {
    throw new ServerConfigurationError(
      `Missing required environment variables: ${missing.join(", ")}`,
    );
  }

  return Object.fromEntries(names.map((name) => [name, env[name].trim()]));
}
