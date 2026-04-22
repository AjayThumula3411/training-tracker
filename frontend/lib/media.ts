const backendOrigin = "http://localhost:4000";

export const resolveAssetUrl = (value?: string | null) => {
  if (!value) return "";
  if (value.startsWith("http://") || value.startsWith("https://") || value.startsWith("data:")) {
    return value;
  }

  if (value.startsWith("/")) {
    return `${backendOrigin}${value}`;
  }

  return `${backendOrigin}/${value}`;
};
