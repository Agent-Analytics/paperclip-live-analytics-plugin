export const PAPERCLIP_SETUP_HELP_URL = 'https://docs.agentanalytics.sh/guides/paperclip/';

export const PAPERCLIP_SETUP_TASK_TITLE = 'Hire an analyst to use AgentAnalytics';

export const PAPERCLIP_SETUP_SKILL_INSTALL = 'npx skills add Agent-Analytics/agent-analytics-skill@agent-analytics';

export const PAPERCLIP_SETUP_TASK_CONTENT = `Hire or assign the analytics analyst for our company.

First install the Agent Analytics skill in Paperclip:
${PAPERCLIP_SETUP_SKILL_INSTALL}

Make sure Agent Analytics is available to the analyst and the engineer working on the project. Ask the engineer on the relevant project to set up Agent Analytics tracking in the codebase.

If approval is needed, send me the approval link, wait for me to sign in with Google or GitHub, accept the finish code I reply with, and then continue by creating the project, adding tracking and key events, and verifying the first event.`;
