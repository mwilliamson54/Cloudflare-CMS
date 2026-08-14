const fieldTypes = ["text", "textarea", "number", "date", "boolean", "select", "media"] as const;

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export function parseCustomFields(specification: string) {
  return specification.split("\n").map(line => line.trim()).filter(Boolean).map(line => {
    const [rawKey, rawType, rawOptions] = line.split(":");
    const type = fieldTypes.includes(rawType as typeof fieldTypes[number]) ? rawType as typeof fieldTypes[number] : "text";
    const key = slugify(rawKey || "field");
    const options = type === "select" && rawOptions ? rawOptions.split("|").map(option => option.trim()).filter(Boolean).map(option => ({ value: slugify(option), label: option })) : undefined;
    return { key, label: (rawKey || "Field").replace(/[-_]/g, " "), type, options };
  });
}
