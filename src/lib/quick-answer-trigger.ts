/**
 * A cheap first test for palette queries that might have a quick answer: something with a digit,
 * `uuid`, or the punctuation colours, cron macros and selectors start with. Only these load the
 * quick-answer code, so typing ordinary words never does. `quickAnswer()` makes the real decision,
 * and its tests check every answer it gives passes this test first.
 */
export const mayHaveQuickAnswer = (input: string) => {
  const query = input.trim();
  return query.length >= 2 && /\d|^(?:uuid|guid)|^[@#.[:*&]|[[:>~+(]/iu.test(query);
};
