# HAP Template Format

HAP templates describe a database definition without private records. They are the
portable contract for shipped templates, user exports, demo datasets, and future
template upgrades.

## Envelope

```json
{
  "format_version": 1,
  "template_version": "1.0.0",
  "name": "Research archive",
  "description": "Optional public description.",
  "payload": {}
}
```

- `format_version` is the parser contract. R1 supports `1`.
- `template_version` is the template author's semver, independent from the parser.
- `name` and `description` are display metadata.
- `payload` contains the database definition.

## Payload

```json
{
  "database": {
    "name": "Research archive",
    "locale": "fr-CA"
  },
  "tables": [
    {
      "key": "works",
      "name": "Works",
      "fields": [
        {
          "key": "title",
          "name": "title",
          "type": "text",
          "position": 0,
          "options": {},
          "validation": {}
        }
      ],
      "views": [],
      "reports": []
    }
  ],
  "demo_records": []
}
```

Rules:

- Template `key` values are stable, lowercase, slug-like identifiers scoped to their
  parent object. They are not database UUIDs.
- Exported templates must not include record IDs, timestamps, user IDs, workspace IDs,
  or private record data.
- `fields[].options.target_table` uses a table `key` for reference fields.
- View configs and report placeholders use field/table keys wherever they refer to
  schema objects. Installation remaps those keys to generated UUIDs.
- `reports` are placeholders in R1-E1. Query and layout objects are preserved, but
  the report engine is not implemented by this task.

## Demo Dataset Variant

`demo_records` is reserved for public sample records shipped with a template:

```json
{
  "table": "works",
  "records": [
    {
      "title": "Example work"
    }
  ]
}
```

R1-E1 documents and stores the demo dataset variant. R1-E3 will define shipped demo
datasets, and later import work will validate record values through the field-type
registry.

## Upgrade Policy

Installing a newer version of a shipped template over a database derived from an older
version must propose additive diffs only:

- new tables;
- new fields;
- new views;
- new report placeholders;
- non-destructive metadata updates.

Deletes, field type changes, table renames, and incompatible reference changes are
not applied automatically. They require a future explicit migration flow with a data
impact preview.
