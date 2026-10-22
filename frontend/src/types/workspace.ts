export interface Region { code: string; name: string }
export interface District extends Region { region_code: string }
export interface Ward extends Region { district_code: string }
export interface Geography { regions: Region[]; districts: District[]; wards: Ward[] }
export interface IdentityCase { case_id: string; status: string; residence_region_code: string | null; user_id?: string }
export interface Inquiry { inquiry_id: string; listing_id: string; kind: string; status: string; scheduled_at: string | null; officer_id?: string; customer_id?: string }
export interface Notification { notification_id: string; body: string; read_at: string | null; created_at: string }
export interface Booking { booking_id: string; listing_id: string; check_in: string; check_out: string; status: string; guests: number; expires_at: string }
export interface Deal { deal_id: string; listing_id: string; status: string; agreed_price: string; currency: string }
export interface Assignment { assignment_id: string; officer_id: string; region_code: string; district_code?: string; ward_code?: string; available: boolean; active: boolean }
export interface Message { message_id: string; body: string; from_me: boolean; created_at: string }
export interface ChangeRequest { request_id: string; listing_id: string; reason: string; status: string }
export interface StaffMember {
  user_id: string; email: string | null; first_name: string; last_name: string; enabled: boolean; setup_pending: boolean; roles: string[];
  assignments: { assignment_id: string; region_code: string; district_code: string | null; ward_code: string | null; active: boolean; available: boolean }[];
}
