import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';

// Mantine's DateInput parses typed text with dayjs(text, valueFormat), which honours the format only with this
// plugin. Without it dayjs falls back to the browser parser, which reads 03.11.2026 as 11 March and gives up on
// 13.10.2026, so every typed date in the DD.MM.YYYY fields came out wrong.
dayjs.extend(customParseFormat);
