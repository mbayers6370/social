const sourceRoot = new URL("../src/", import.meta.url).href;
export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context);
  } catch (error) {
    if (
      error.code === "ERR_MODULE_NOT_FOUND" &&
      context.parentURL?.startsWith(sourceRoot) &&
      specifier.startsWith(".") &&
      !/\.[^/]+$/.test(specifier)
    )
      return nextResolve(`${specifier}.ts`, context);
    throw error;
  }
}
