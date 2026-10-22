import { useState } from "react";
import type { ComponentType } from "react";
import type { PageProps } from "keycloakify/login/pages/PageProps";
import type { KcContext } from "../KcContext";
import type { I18n } from "../i18n";
import type { BomaTemplateProps } from "../Template";
import {
    Box,
    Button,
    Checkbox,
    FormControlLabel,
    IconButton,
    InputAdornment,
    TextField,
    Typography,
} from "@mui/material";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";

const brandNode = (
    <Box sx={{ textAlign: "center" }}>
        <Typography
            variant="h4"
            sx={{ fontWeight: 900, color: "#0F4C5C", letterSpacing: 2, lineHeight: 1 }}
        >
            BOMA
        </Typography>
        <Typography
            variant="subtitle1"
            sx={{ fontWeight: 700, color: "#E07A2F", letterSpacing: 4, fontSize: "0.75rem" }}
        >
            REAL ESTATE
        </Typography>
    </Box>
);

export default function LoginUpdatePassword(
    props: PageProps<Extract<KcContext, { pageId: "login-update-password.ftl" }>, I18n>
) {
    const { kcContext, i18n, doUseDefaultCss, Template: BaseTemplate, classes } = props;
    const Template = BaseTemplate as ComponentType<BomaTemplateProps>;

    const { url, messagesPerField, isAppInitiatedAction } = kcContext;

    const { msg, msgStr } = i18n;

    const [showNew, setShowNew] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);

    return (
        <Template
            kcContext={kcContext}
            i18n={i18n}
            doUseDefaultCss={doUseDefaultCss}
            classes={classes}
            displayMessage={!messagesPerField.existsError("password", "password-confirm")}
            headerNode={msg("updatePasswordTitle")}
            logoNode={brandNode}
        >
            <form action={url.loginAction} method="post">
                {/* New password */}
                <TextField
                    fullWidth
                    variant="outlined"
                    id="password-new"
                    name="password-new"
                    label={msgStr("passwordNew")}
                    type={showNew ? "text" : "password"}
                    autoFocus
                    autoComplete="new-password"
                    error={messagesPerField.existsError("password")}
                    helperText={
                        messagesPerField.existsError("password")
                            ? messagesPerField.get("password")
                            : undefined
                    }
                    slotProps={{
                        input: {
                            endAdornment: (
                                <InputAdornment position="end">
                                    <IconButton onClick={() => setShowNew(v => !v)} edge="end">
                                        {showNew ? <VisibilityOff /> : <Visibility />}
                                    </IconButton>
                                </InputAdornment>
                            ),
                        },
                    }}
                    sx={{ mb: 2 }}
                />

                {/* Confirm password */}
                <TextField
                    fullWidth
                    variant="outlined"
                    id="password-confirm"
                    name="password-confirm"
                    label={msgStr("passwordConfirm")}
                    type={showConfirm ? "text" : "password"}
                    autoComplete="new-password"
                    error={messagesPerField.existsError("password-confirm")}
                    helperText={
                        messagesPerField.existsError("password-confirm")
                            ? messagesPerField.get("password-confirm")
                            : undefined
                    }
                    slotProps={{
                        input: {
                            endAdornment: (
                                <InputAdornment position="end">
                                    <IconButton onClick={() => setShowConfirm(v => !v)} edge="end">
                                        {showConfirm ? <VisibilityOff /> : <Visibility />}
                                    </IconButton>
                                </InputAdornment>
                            ),
                        },
                    }}
                    sx={{ mb: 2 }}
                />

                {/* Logout other sessions */}
                <FormControlLabel
                    control={
                        <Checkbox
                            id="logout-sessions"
                            name="logout-sessions"
                            value="on"
                            defaultChecked
                            size="small"
                            sx={{ color: "#0F4C5C", "&.Mui-checked": { color: "#0F4C5C" } }}
                        />
                    }
                    label={<Typography variant="body2">{msg("logoutOtherSessions")}</Typography>}
                    sx={{ mb: 2 }}
                />

                <Box sx={{ display: "flex", gap: 1 }}>
                    <Button
                        fullWidth
                        type="submit"
                        variant="contained"
                        size="large"
                        sx={{
                            py: 1.5,
                            background: "linear-gradient(90deg, #0F4C5C, #E07A2F)",
                            "&:hover": { background: "linear-gradient(90deg, #0A3540, #B85F1F)" },
                            boxShadow: "0 4px 14px rgba(27,107,58,0.4)",
                        }}
                    >
                        {msgStr("doSubmit")}
                    </Button>

                    {isAppInitiatedAction && (
                        <Button
                            fullWidth
                            type="submit"
                            name="cancel-aia"
                            value="true"
                            variant="outlined"
                            size="large"
                            sx={{ py: 1.5, borderColor: "#0F4C5C", color: "#0F4C5C" }}
                        >
                            {msg("doCancel")}
                        </Button>
                    )}
                </Box>
            </form>
        </Template>
    );
}
