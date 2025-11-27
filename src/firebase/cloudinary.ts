import * as FileSystem from "expo-file-system";

const CLOUDINARY_CONFIG = {
  cloudName: "dr1wnqewh",
  uploadPreset: "products_upload",
};

const getUploadUrl = () =>
  `https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloudName}/image/upload`;

const prepareFile = async (uri: string) => {
  if (uri.startsWith("http") || uri.includes("cloudinary.com")) {
    return { type: "remote", value: uri };
  }

  if (uri.startsWith("data:image")) {
    return { type: "base64", value: uri };
  }

  // NEW Expo File API
  const file = new FileSystem.File(uri);
  const info = await file.info();

  if (!info.exists) {
    throw new Error("File not found: " + uri);
  }

  const filename = uri.split("/").pop() || "image.jpg";
  const ext = filename.split(".").pop()?.toLowerCase();
  const mime =
    ext === "png" ? "image/png" :
    ext === "webp" ? "image/webp" :
    "image/jpeg";

  return {
    type: "file",
    value: { uri, name: filename, type: mime }
  };
};
type RNFile = { uri: string; name: string; type: string };
export const uploadToCloudinary = async (
  imageUri: string,
  folder = "products"
): Promise<string> => {
  const prepared = await prepareFile(imageUri);

  // If it's already a remote Cloudinary url or other http url
  if (prepared.type === "remote") {
    return prepared.value as string;
  }

  const form = new FormData();

  if (prepared.type === "file") {
    // prepared.value has type RNFile
    const file = prepared.value as RNFile;

    // TypeScript's FormData types in React Native are messy, so cast to any for the file blob/object.
    // This object shape ({ uri, name, type }) is what fetch expects in RN.
    form.append("file", {
      uri: file.uri,
      name: file.name,
      type: file.type,
    } as any);
  } else if (prepared.type === "base64") {
    // prepared.value is a base64 data URI string
    form.append("file", prepared.value as string);
  } else {
    // Fallback, should not happen
    throw new Error("Unsupported prepared type: " + (prepared as any).type);
  }

  form.append("upload_preset", CLOUDINARY_CONFIG.uploadPreset);
  if (folder) form.append("folder", folder);

  const res = await fetch(getUploadUrl(), {
    method: "POST",
    body: form,
    // DO NOT set Content-Type: multipart/form-data — letting fetch set boundary is required.
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error("Cloudinary upload failed: " + errorText);
  }

  const data = await res.json();
  return data.secure_url as string;
};

export const uploadMultipleToCloudinary = async (
  imageUris: string[],
  folder: string
): Promise<string[]> => {
  const urls: string[] = [];

  for (let i = 0; i < imageUris.length; i++) {
    try {
      const url = await uploadToCloudinary(imageUris[i], folder);
      urls.push(url);
    } catch (e) {
      console.error("❌ Upload failed:", e);
    }
  }

  if (urls.length === 0) throw new Error("All uploads failed");
  return urls;
};

export const testCloudinaryConnection = async () => {
  try {
    const tinyBase64 =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/l1zGyQAAAABJRU5ErkJggg==";

    const url = await uploadToCloudinary(tinyBase64, "test");
    console.log("✔ Cloudinary test OK:", url);
    return true;
  } catch {
    console.log("⚠ Cloudinary test failed");
    return false;
  }
};
