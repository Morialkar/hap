import { useMemo } from 'react';
import { useI18n } from '../contexts/I18nContext';
import { FIELD_TYPES, FIELD_TYPE_ORDER } from '../lib/fieldTypes';
import type { BuilderField, FieldOptionSchema, FieldValidationSchema } from '../lib/fieldTypes';

interface FieldOptionPanelProps {
  field: BuilderField;
  availableTables?: { id: string; name: string }[];
  onChange: (field: BuilderField) => void;
}

type OptionValue = string | number | boolean | string[] | undefined;

function getOptionValue(options: Record<string, unknown>, key: string): OptionValue {
  const value = options[key];
  if (value === undefined || value === null) return undefined;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value;
  if (Array.isArray(value)) return value as string[];
  return String(value);
}

function parseInputValue(type: FieldOptionSchema['type'], raw: string): unknown {
  switch (type) {
    case 'number':
      return raw === '' ? undefined : Number(raw);
    case 'boolean':
      return raw === 'true';
    case 'string[]':
      return raw.split('\n').map((v) => v.trim()).filter(Boolean);
    case 'select':
    case 'table':
    case 'string':
    default:
      return raw === '' ? undefined : raw;
  }
}

function InputControl({
  schema,
  value,
  onChange,
  tables,
}: {
  schema: FieldOptionSchema;
  value: OptionValue;
  onChange: (value: unknown) => void;
  tables?: { id: string; name: string }[];
}) {
  const { t } = useI18n();

  switch (schema.type) {
    case 'boolean':
      return (
        <div className="form-check form-switch">
          <input
            id={`option-${schema.key}`}
            className="form-check-input"
            type="checkbox"
            role="switch"
            checked={value === true}
            onChange={(e) => onChange(e.target.checked)}
          />
          <label className="form-check-label" htmlFor={`option-${schema.key}`}>
            {t(schema.label)}
          </label>
        </div>
      );

    case 'select':
      return (
        <>
          <label htmlFor={`option-${schema.key}`} className="form-label">
            {t(schema.label)}
          </label>
          <select
            id={`option-${schema.key}`}
            className="form-select"
            value={(value as string) || ''}
            onChange={(e) => onChange(parseInputValue('select', e.target.value))}
          >
            <option value="" disabled>
              {t('common.search')}...
            </option>
            {schema.options?.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {t(opt.label)}
              </option>
            ))}
          </select>
        </>
      );

    case 'table':
      return (
        <>
          <label htmlFor={`option-${schema.key}`} className="form-label">
            {t(schema.label)}
          </label>
          <select
            id={`option-${schema.key}`}
            className="form-select"
            value={(value as string) || ''}
            onChange={(e) => onChange(parseInputValue('table', e.target.value))}
          >
            <option value="" disabled>
              {t('common.search')}...
            </option>
            {tables?.map((table) => (
              <option key={table.id} value={table.id}>
                {table.name}
              </option>
            ))}
          </select>
        </>
      );

    case 'string[]':
      return (
        <>
          <label htmlFor={`option-${schema.key}`} className="form-label">
            {t(schema.label)}
          </label>
          <textarea
            id={`option-${schema.key}`}
            className="form-control"
            rows={4}
            value={Array.isArray(value) ? value.join('\n') : ''}
            onChange={(e) => onChange(parseInputValue('string[]', e.target.value))}
            placeholder={schema.placeholder || t('builder.fieldName.placeholder')}
          />
        </>
      );

    case 'number':
      return (
        <>
          <label htmlFor={`option-${schema.key}`} className="form-label">
            {t(schema.label)}
          </label>
          <input
            id={`option-${schema.key}`}
            type="number"
            className="form-control"
            min={schema.min}
            max={schema.max}
            step={schema.step}
            value={value === undefined ? '' : String(value)}
            onChange={(e) => onChange(parseInputValue('number', e.target.value))}
            placeholder={schema.placeholder}
          />
        </>
      );

    case 'string':
    default:
      return (
        <>
          <label htmlFor={`option-${schema.key}`} className="form-label">
            {t(schema.label)}
          </label>
          <input
            id={`option-${schema.key}`}
            type="text"
            className="form-control"
            value={value === undefined ? '' : String(value)}
            onChange={(e) => onChange(parseInputValue('string', e.target.value))}
            placeholder={schema.placeholder}
          />
        </>
      );
  }
}

function OptionGroup({
  schemas,
  values,
  onChange,
  tables,
  title,
  emptyMessage,
}: {
  schemas: (FieldOptionSchema | FieldValidationSchema)[];
  values: Record<string, unknown>;
  onChange: (patch: Record<string, unknown>) => void;
  tables?: { id: string; name: string }[];
  title: string;
  emptyMessage: string;
}) {
  return (
    <>
      <h5 className="mt-4 mb-2">{title}</h5>
      {schemas.length === 0 ? (
        <p className="text-muted">{emptyMessage}</p>
      ) : (
        <div className="vstack gap-3">
          {schemas.map((schema) => (
            <InputControl
              key={schema.key}
              schema={schema}
              value={getOptionValue(values, schema.key)}
              onChange={(newValue) => onChange({ [schema.key]: newValue })}
              tables={tables}
            />
          ))}
        </div>
      )}
    </>
  );
}

export function FieldOptionPanel({ field, availableTables, onChange }: FieldOptionPanelProps) {
  const { t } = useI18n();

  const definition = useMemo(() => FIELD_TYPES[field.type], [field.type]);

  const updateField = (patch: Partial<BuilderField>) => {
    onChange({ ...field, ...patch });
  };

  const updateOptions = (optionPatch: Record<string, unknown>) => {
    updateField({ options: { ...field.options, ...optionPatch } });
  };

  const updateValidation = (validationPatch: Record<string, unknown>) => {
    updateField({ validation: { ...field.validation, ...validationPatch } });
  };

  return (
    <div className="card h-100">
      <div className="card-header">
        <h4 className="card-title mb-0">{t('builder.options.title')}</h4>
      </div>
      <div className="card-body">
        <div className="mb-3">
          <label htmlFor="field-name" className="form-label">
            {t('builder.fieldName.label')}
          </label>
          <input
            id="field-name"
            type="text"
            className="form-control"
            value={field.name}
            onChange={(e) => updateField({ name: e.target.value })}
            placeholder={t('builder.fieldName.placeholder')}
          />
        </div>

        <div className="mb-3">
          <label htmlFor="field-type" className="form-label">
            {t('builder.fieldType.label')}
          </label>
          <select
            id="field-type"
            className="form-select"
            value={field.type}
            onChange={(e) => updateField({ type: e.target.value as BuilderField['type'] })}
          >
            {FIELD_TYPE_ORDER.map((type) => (
              <option key={type} value={type}>
                {t(FIELD_TYPES[type].labelKey)}
              </option>
            ))}
          </select>
        </div>

        {field.type !== 'image' && field.type !== 'file' && field.type !== 'long_text' && (
          <div className="form-check form-switch mb-3">
            <input
              id="field-is-filterable"
              className="form-check-input cursor-pointer"
              type="checkbox"
              role="switch"
              checked={field.is_filterable !== false}
              onChange={(e) => updateField({ is_filterable: e.target.checked })}
            />
            <label className="form-check-label cursor-pointer text-muted small" htmlFor="field-is-filterable">
              {t('fieldType.isFilterable')}
            </label>
          </div>
        )}

        <OptionGroup
          title={t('builder.options.title')}
          schemas={definition.options}
          values={field.options}
          onChange={updateOptions}
          tables={availableTables}
          emptyMessage={t('builder.options.noOptions')}
        />

        <OptionGroup
          title={t('builder.validation.title')}
          schemas={definition.validation}
          values={field.validation}
          onChange={updateValidation}
          tables={availableTables}
          emptyMessage={t('builder.validation.noRules')}
        />
      </div>
    </div>
  );
}
