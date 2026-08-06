// The union lives in @hap/core so drivers and UI cannot drift apart.
export type { FieldType } from '@hap/core';
import type { FieldType } from '@hap/core';

export interface FieldOptionSchema {
  key: string;
  type: 'string' | 'number' | 'boolean' | 'string[]' | 'select' | 'table';
  label: string;
  required?: boolean;
  min?: number;
  max?: number;
  step?: number;
  options?: { value: string; label: string }[];
  placeholder?: string;
  description?: string;
}

export interface FieldValidationSchema {
  key: string;
  type: 'boolean' | 'number' | 'string' | 'select';
  label: string;
  options?: { value: string; label: string }[];
  placeholder?: string;
  description?: string;
}

export interface FieldTypeDefinition {
  type: FieldType;
  icon: string;
  labelKey: string;
  descriptionKey: string;
  options: FieldOptionSchema[];
  validation: FieldValidationSchema[];
  supportsMultiline?: boolean;
}

export const FIELD_TYPES: Record<FieldType, FieldTypeDefinition> = {
  title: {
    type: 'title',
    icon: 'heading',
    labelKey: 'fieldType.title.label',
    descriptionKey: 'fieldType.title.description',
    options: [
      {
        key: 'max_length',
        type: 'number',
        label: 'fieldType.text.options.maxLength',
        required: false,
        min: 1,
        max: 10000,
        step: 1,
        placeholder: '255',
      },
      {
        key: 'placeholder',
        type: 'string',
        label: 'fieldType.text.options.placeholder',
      },
    ],
    validation: [
      {
        key: 'required',
        type: 'boolean',
        label: 'fieldType.validation.required',
      },
    ],
  },
  text: {
    type: 'text',
    icon: 'forms',
    labelKey: 'fieldType.text.label',
    descriptionKey: 'fieldType.text.description',
    options: [
      {
        key: 'max_length',
        type: 'number',
        label: 'fieldType.text.options.maxLength',
        required: false,
        min: 1,
        max: 10000,
        step: 1,
        placeholder: '255',
      },
      {
        key: 'placeholder',
        type: 'string',
        label: 'fieldType.text.options.placeholder',
      },
      {
        key: 'showCharCount',
        type: 'boolean',
        label: 'fieldType.text.options.showCharCount',
      },
    ],
    validation: [
      {
        key: 'required',
        type: 'boolean',
        label: 'fieldType.validation.required',
      },
      {
        key: 'minLength',
        type: 'number',
        label: 'fieldType.validation.minLength',
        placeholder: '0',
      },
      {
        key: 'maxLength',
        type: 'number',
        label: 'fieldType.validation.maxLength',
        placeholder: '255',
      },
      {
        key: 'pattern',
        type: 'string',
        label: 'fieldType.validation.pattern',
        placeholder: '^[A-Za-z]+$',
      },
    ],
  },
  long_text: {
    type: 'long_text',
    icon: 'align-justified',
    labelKey: 'fieldType.longText.label',
    descriptionKey: 'fieldType.longText.description',
    options: [
      {
        key: 'rows',
        type: 'number',
        label: 'fieldType.longText.options.rows',
        min: 2,
        max: 50,
        step: 1,
        placeholder: '4',
      },
      {
        key: 'max_length',
        type: 'number',
        label: 'fieldType.longText.options.maxLength',
        min: 1,
        step: 1,
        placeholder: '2000',
      },
    ],
    validation: [
      {
        key: 'required',
        type: 'boolean',
        label: 'fieldType.validation.required',
      },
      {
        key: 'minLength',
        type: 'number',
        label: 'fieldType.validation.minLength',
      },
      {
        key: 'maxLength',
        type: 'number',
        label: 'fieldType.validation.maxLength',
      },
    ],
    supportsMultiline: true,
  },
  number: {
    type: 'number',
    icon: 'calculator',
    labelKey: 'fieldType.number.label',
    descriptionKey: 'fieldType.number.description',
    options: [
      {
        key: 'min',
        type: 'number',
        label: 'fieldType.number.options.min',
      },
      {
        key: 'max',
        type: 'number',
        label: 'fieldType.number.options.max',
      },
      {
        key: 'step',
        type: 'number',
        label: 'fieldType.number.options.step',
        placeholder: '1',
      },
      {
        key: 'decimals',
        type: 'number',
        label: 'fieldType.number.options.decimals',
        min: 0,
        max: 10,
        step: 1,
        placeholder: '0',
      },
    ],
    validation: [
      {
        key: 'required',
        type: 'boolean',
        label: 'fieldType.validation.required',
      },
      {
        key: 'min',
        type: 'number',
        label: 'fieldType.validation.min',
      },
      {
        key: 'max',
        type: 'number',
        label: 'fieldType.validation.max',
      },
    ],
  },
  date: {
    type: 'date',
    icon: 'calendar',
    labelKey: 'fieldType.date.label',
    descriptionKey: 'fieldType.date.description',
    options: [
      {
        key: 'includeTime',
        type: 'boolean',
        label: 'fieldType.date.options.includeTime',
      },
      {
        key: 'allowPartial',
        type: 'boolean',
        label: 'fieldType.date.options.allowPartial',
      },
    ],
    validation: [
      {
        key: 'required',
        type: 'boolean',
        label: 'fieldType.validation.required',
      },
      {
        key: 'minDate',
        type: 'string',
        label: 'fieldType.date.validation.minDate',
      },
      {
        key: 'maxDate',
        type: 'string',
        label: 'fieldType.date.validation.maxDate',
      },
    ],
  },
  boolean: {
    type: 'boolean',
    icon: 'toggle-right',
    labelKey: 'fieldType.boolean.label',
    descriptionKey: 'fieldType.boolean.description',
    options: [
      {
        key: 'defaultValue',
        type: 'select',
        label: 'fieldType.boolean.options.defaultValue',
        options: [
          { value: 'unset', label: 'fieldType.boolean.options.unset' },
          { value: 'true', label: 'fieldType.boolean.options.true' },
          { value: 'false', label: 'fieldType.boolean.options.false' },
        ],
      },
    ],
    validation: [
      {
        key: 'required',
        type: 'boolean',
        label: 'fieldType.validation.required',
      },
    ],
  },
  select: {
    type: 'select',
    icon: 'list-check',
    labelKey: 'fieldType.select.label',
    descriptionKey: 'fieldType.select.description',
    options: [
      {
        key: 'values',
        type: 'string[]',
        label: 'fieldType.select.options.values',
        required: true,
      },
      {
        key: 'multi',
        type: 'boolean',
        label: 'fieldType.select.options.multi',
      },
      {
        key: 'allowOther',
        type: 'boolean',
        label: 'fieldType.select.options.allowOther',
      },
    ],
    validation: [
      {
        key: 'required',
        type: 'boolean',
        label: 'fieldType.validation.required',
      },
    ],
  },
  reference: {
    type: 'reference',
    icon: 'link',
    labelKey: 'fieldType.reference.label',
    descriptionKey: 'fieldType.reference.description',
    options: [
      {
        key: 'target_table',
        type: 'table',
        label: 'fieldType.reference.options.targetTable',
        required: true,
      },
      {
        key: 'multi',
        type: 'boolean',
        label: 'fieldType.reference.options.multi',
      },
      {
        key: 'displayField',
        type: 'string',
        label: 'fieldType.reference.options.displayField',
        placeholder: 'name',
      },
    ],
    validation: [
      {
        key: 'required',
        type: 'boolean',
        label: 'fieldType.validation.required',
      },
    ],
  },
  image: {
    type: 'image',
    icon: 'photo',
    labelKey: 'fieldType.image.label',
    descriptionKey: 'fieldType.image.description',
    options: [
      {
        key: 'multi',
        type: 'boolean',
        label: 'fieldType.image.options.multi',
      },
      {
        key: 'maxSizeMB',
        type: 'number',
        label: 'fieldType.image.options.maxSizeMB',
        min: 0.1,
        step: 0.1,
        placeholder: '5',
      },
      {
        key: 'acceptedTypes',
        type: 'string[]',
        label: 'fieldType.image.options.acceptedTypes',
        placeholder: 'image/jpeg,image/png',
      },
    ],
    validation: [
      {
        key: 'required',
        type: 'boolean',
        label: 'fieldType.validation.required',
      },
    ],
  },
  file: {
    type: 'file',
    icon: 'file',
    labelKey: 'fieldType.file.label',
    descriptionKey: 'fieldType.file.description',
    options: [
      {
        key: 'multi',
        type: 'boolean',
        label: 'fieldType.file.options.multi',
      },
      {
        key: 'maxSizeMB',
        type: 'number',
        label: 'fieldType.file.options.maxSizeMB',
        min: 0.1,
        step: 0.1,
        placeholder: '10',
      },
      {
        key: 'acceptedTypes',
        type: 'string[]',
        label: 'fieldType.file.options.acceptedTypes',
        placeholder: '.pdf,.docx',
      },
    ],
    validation: [
      {
        key: 'required',
        type: 'boolean',
        label: 'fieldType.validation.required',
      },
    ],
  },
  url: {
    type: 'url',
    icon: 'world',
    labelKey: 'fieldType.url.label',
    descriptionKey: 'fieldType.url.description',
    options: [],
    validation: [
      {
        key: 'required',
        type: 'boolean',
        label: 'fieldType.validation.required',
      },
    ],
  },
  email: {
    type: 'email',
    icon: 'mail',
    labelKey: 'fieldType.email.label',
    descriptionKey: 'fieldType.email.description',
    options: [],
    validation: [
      {
        key: 'required',
        type: 'boolean',
        label: 'fieldType.validation.required',
      },
    ],
  },
  gps: {
    type: 'gps',
    icon: 'map-pin',
    labelKey: 'fieldType.gps.label',
    descriptionKey: 'fieldType.gps.description',
    options: [
      {
        key: 'show_locality',
        type: 'boolean',
        label: 'fieldType.gps.options.showLocality',
      },
    ],
    validation: [
      {
        key: 'required',
        type: 'boolean',
        label: 'fieldType.validation.required',
      },
    ],
  },
  compound: {
    type: 'compound',
    icon: 'binary',
    labelKey: 'fieldType.compound.label',
    descriptionKey: 'fieldType.compound.description',
    options: [
      {
        key: 'template',
        type: 'string',
        label: 'fieldType.compound.options.template',
        required: true,
        placeholder: '${Prénom} ${Nom}',
      },
      {
        key: 'is_title',
        type: 'boolean',
        label: 'fieldType.compound.options.isTitle',
      },
    ],
    validation: [],
  },
};

export interface BuilderField {
  id: string;
  name: string;
  type: FieldType;
  position: number;
  options: Record<string, unknown>;
  validation: Record<string, unknown>;
  is_filterable?: boolean;
  isNew?: boolean;
  persistedId?: string | null;
}

export const FIELD_TYPE_ORDER: FieldType[] = [
  'title',
  'text',
  'long_text',
  'number',
  'date',
  'boolean',
  'select',
  'reference',
  'image',
  'file',
  'url',
  'email',
  'gps',
  'compound',
];
