import { Box, Typography } from "@mui/material";

/** BOMA mark (house roofline) and wordmark, shared by every login page. */
export default function Brand() {
    return (
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            <Box
                component="svg"
                viewBox="0 0 48 48"
                aria-hidden="true"
                sx={{ width: 44, height: 44, flexShrink: 0 }}
            >
                <rect width="48" height="48" rx="12" fill="#0F4C5C" />
                <path d="M11 24 24 13l13 11" fill="none" stroke="#E07A2F" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M15 22.5V35h18V22.5" fill="none" stroke="#fff" strokeWidth="3" strokeLinejoin="round" />
                <path d="M21.5 35v-6.5h5V35" fill="#fff" />
            </Box>
            <Box sx={{ lineHeight: 1 }}>
                <Typography
                    component="div"
                    sx={{ fontWeight: 900, fontSize: "1.6rem", color: "#0F4C5C", letterSpacing: "0.12em", lineHeight: 1 }}
                >
                    BOMA
                </Typography>
                <Typography
                    component="div"
                    sx={{ fontWeight: 600, fontSize: "0.7rem", color: "#5B6B70", letterSpacing: "0.14em", mt: 0.5 }}
                >
                    PROPERTY · TANZANIA
                </Typography>
            </Box>
        </Box>
    );
}
