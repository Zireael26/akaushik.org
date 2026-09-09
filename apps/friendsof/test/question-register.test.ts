import assert from 'node:assert/strict';
import { parseGfmRow, parseQuestionRegister } from '../lib/question-register';

const source = `# Questions and decision record

Working sheet · answers below retain their source wording.

Use every question in source order. A proposal is not a decision.

## A. Scope and people

Intro for section A.

| ID | Question | Decision owner to confirm | Record needed |
|---|---|---|---|
| Q01 | Which site participates? | Client sponsor | Named site |
| Q02 | Is the \`request | intent\` split correct? | Sponsor | Confirmed vocabulary |

## B. Operations

| ID | Question | Why it changes the design |
|---|---|---|
| Q03 | What happens when stock is unavailable? | Defines the fallback |

This sentence follows all questions and must remain visible.

## Decision capture template

| Field | Entry |
|---|---|
| Exact question | |

## End-of-meeting record

| Item | Capture |
|---|---|
| Open items | |
`;

const register = parseQuestionRegister(source);
assert.ok(register);
assert.equal(register.questionCount, 3);
assert.deepEqual(register.sections.map((section) => section.id), ['A', 'B']);
assert.deepEqual(register.sections.flatMap((section) => section.questions.map((question) => question.id)), ['Q01', 'Q02', 'Q03']);
assert.equal(register.sections[0]?.questions[0]?.question, 'Which site participates?');
assert.deepEqual(register.sections[0]?.questions[0]?.metadata, [
  { label: 'Decision owner to confirm', value: 'Client sponsor' },
  { label: 'Record needed', value: 'Named site' },
]);
assert.equal(register.prefixMarkdown.includes('# Questions and decision record'), false, 'ReaderHeader replaces only the first source H1');
assert.equal(register.prefixMarkdown.includes('Working sheet'), true);
assert.equal(register.prefixMarkdown.includes('A proposal is not a decision.'), true);
assert.equal(register.sections[1]?.trailingMarkdown.includes('must remain visible'), true);
assert.equal(register.suffixMarkdown.includes('## Decision capture template'), true);
assert.equal(register.suffixMarkdown.includes('## End-of-meeting record'), true);
assert.equal(parseQuestionRegister('# Ordinary document\n\nNo register.'), null);
assert.deepEqual(parseGfmRow('| Q09 | A question with an escaped \\| pipe | `code | stays` |'), [
  ' Q09 ',
  ' A question with an escaped | pipe ',
  ' `code | stays` ',
]);

console.log('question-register: 15 focused assertions passed');
