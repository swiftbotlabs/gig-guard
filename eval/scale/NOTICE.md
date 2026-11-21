# Third-party contracts in eval/scale/samples

- `SB_*.sol`: from SmartBugs Curated (https://github.com/smartbugs/smartbugs-curated), Apache License 2.0. Each file's exact
  source URL (pinned commit) and original origin are in `manifest.json`. Modification: the dataset's own answer markers
  (the header comment with `@vulnerable_at_lines` and the `// <yes> <report> ...` lines) were removed by `select.mjs`;
  nothing else was changed.
- `OZ_*.sol`: from OpenZeppelin Contracts v5.1.0 (https://github.com/OpenZeppelin/openzeppelin-contracts), MIT License,
  copied unchanged.

These files are test inputs for measuring the ship gate. They are not part of Gig Guard's code.
