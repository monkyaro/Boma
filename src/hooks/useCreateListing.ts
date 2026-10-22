"use client";

import { useMutation } from "@tanstack/react-query";
import { listingAPI } from "@/services/listingApi";

export function useCreateListing() {
  return useMutation({ mutationFn: listingAPI.createListing });
}
