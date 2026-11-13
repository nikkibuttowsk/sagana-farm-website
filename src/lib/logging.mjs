export function reportError(deps, error, context) {
  const details = {
    name: error?.name ?? "Unknown error",
    ...(typeof error?.code === "string" ? { code: error.code } : {}),
  };

  if (deps.logger?.error) {
    deps.logger.error(context, details);
    return;
  }

  console.error(context, details);
}
