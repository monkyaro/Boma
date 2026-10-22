import apiClient from "./apiClient";
import type { Listing, NewListing } from "@/types/listing";

export const listingAPI = {
  createListing: async (data: NewListing): Promise<Listing> => {
    const rs = await apiClient.post<Listing>("/listings", data);
    return rs.data;
  },
};
