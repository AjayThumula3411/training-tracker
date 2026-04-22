"use client";

import { ChangeEvent, useState } from "react";
import { AxiosError } from "axios";
import toast from "react-hot-toast";
import api from "@/lib/api";
import { resolveAssetUrl } from "@/lib/media";

type ApiError = {
  message?: string;
};

type ProfilePhotoUploadFieldProps = {
  photoUrl: string;
  name?: string;
  uploadPath: string;
  disabled?: boolean;
  onPhotoChange: (photoUrl: string) => void;
  onPhotoUploaded?: (photoUrl: string) => void;
};

const toBase64 = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;

      if (typeof result !== "string") {
        reject(new Error("Unable to read file"));
        return;
      }

      resolve(result.split(",")[1] || "");
    };
    reader.onerror = () => reject(new Error("Unable to read file"));
    reader.readAsDataURL(file);
  });

export default function ProfilePhotoUploadField({
  photoUrl,
  name,
  uploadPath,
  disabled,
  onPhotoChange,
  onPhotoUploaded,
}: ProfilePhotoUploadFieldProps) {
  const [uploading, setUploading] = useState(false);
  const previewUrl = resolveAssetUrl(photoUrl);

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    event.target.value = "";

    if (!file) return;

    if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type)) {
      toast.error("Upload a JPG, PNG, WEBP, or GIF image");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Profile photo must be 5 MB or smaller");
      return;
    }

    try {
      setUploading(true);
      const contentBase64 = await toBase64(file);
      const response = await api.post(uploadPath, {
        fileName: file.name,
        mimeType: file.type,
        contentBase64,
      });

      const nextPhotoUrl =
        (response.data?.photoUrl as string | undefined) ||
        (response.data?.user?.photoUrl as string | undefined) ||
        "";

      onPhotoChange(nextPhotoUrl);
      onPhotoUploaded?.(nextPhotoUrl);
      toast.success("Profile photo uploaded");
    } catch (error) {
      const apiError = error as AxiosError<ApiError>;
      toast.error(apiError.response?.data?.message || "Unable to upload profile photo");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="md:col-span-2">
      <label className="mb-2 block text-sm font-medium text-slate-600">Profile photo</label>
      <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-center">
          <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-[24px] bg-slate-200 text-2xl font-semibold text-slate-600">
            {previewUrl ? (
              <img src={previewUrl} alt={name || "Profile photo"} className="h-full w-full object-cover" />
            ) : (
              (name?.charAt(0) || "P").toUpperCase()
            )}
          </div>

          <div className="flex-1 space-y-3">
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={handleFileChange}
              disabled={disabled || uploading}
              className="block w-full text-sm text-slate-500 file:mr-4 file:rounded-full file:border-0 file:bg-slate-900 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white"
            />
            <p className="text-xs text-slate-500">
              Upload from your device. Supported: JPG, PNG, WEBP, GIF up to 5 MB.
            </p>
            <input
              value={photoUrl}
              onChange={(event) => onPhotoChange(event.target.value)}
              className="field"
              placeholder="Or paste profile photo URL"
              disabled={disabled || uploading}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
