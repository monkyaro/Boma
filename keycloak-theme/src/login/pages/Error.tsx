import type { ComponentType } from "react";
import type { PageProps } from "keycloakify/login/pages/PageProps";
import { kcSanitize } from "keycloakify/lib/kcSanitize";
import type { KcContext } from "../KcContext";
import type { I18n } from "../i18n";
import type { BomaTemplateProps } from "../Template";
import { Box, Button, Typography } from "@mui/material";
import ReportProblemOutlinedIcon from "@mui/icons-material/ReportProblemOutlined";


export default function Error(props: PageProps<Extract<KcContext, { pageId: "error.ftl" }>, I18n>) {
    const { kcContext, i18n, doUseDefaultCss, Template: BaseTemplate, classes } = props;
    const Template = BaseTemplate as ComponentType<BomaTemplateProps>;

    const { message, client, skipLink } = kcContext;

    const { msg } = i18n;

    return (
        <Template
            kcContext={kcContext}
            i18n={i18n}
            doUseDefaultCss={doUseDefaultCss}
            classes={classes}
            displayMessage={false}
            headerNode={msg("errorTitle")}
        >
            <Box sx={{ textAlign: "center", py: 2 }}>
                <ReportProblemOutlinedIcon sx={{ fontSize: 56, color: "#d32f2f", mb: 2 }} />

                <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                    <span dangerouslySetInnerHTML={{ __html: kcSanitize(message.summary) }} />
                </Typography>

                {!skipLink && client !== undefined && client.baseUrl !== undefined && (
                    <Button
                        href={client.baseUrl}
                        variant="contained"
                        size="large"
                        sx={{
                            py: 1.5,
                            px: 4,
                        }}
                    >
                        {msg("backToApplication")}
                    </Button>
                )}
            </Box>
        </Template>
    );
}
