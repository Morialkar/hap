<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>{{ $reportName }}</title>
    <style>
        body {
            font-family: 'DejaVu Sans', sans-serif;
            font-size: 9.5pt;
            color: #1e293b;
            line-height: 1.4;
        }
        h1 {
            font-size: 22pt;
            font-weight: bold;
            color: #0f172a;
            margin-bottom: 5px;
            text-align: left;
        }
        .report-meta {
            border-bottom: 1px solid #e2e8f0;
            padding-bottom: 8px;
            margin-bottom: 20px;
        }
        .group-section {
            margin-bottom: 25px;
            page-break-inside: avoid;
        }
        .group-header {
            font-weight: bold;
            font-size: 11pt;
            color: #0f172a;
            border-bottom: 2px solid #cbd5e1;
            padding-bottom: 3px;
            margin-bottom: 10px;
            text-transform: uppercase;
        }
        table.report-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 15px;
        }
        table.report-table th, table.report-table td {
            border-bottom: 1px solid #e2e8f0;
            padding: 8px 10px;
            text-align: left;
            font-size: 9pt;
        }
        table.report-table th {
            background-color: #f8fafc;
            color: #475569;
            font-weight: bold;
            font-size: 8pt;
            text-transform: uppercase;
            border-top: 1px solid #e2e8f0;
        }
        .report-card {
            border: 1px solid #e2e8f0;
            border-radius: 6px;
            padding: 12px;
            margin-bottom: 12px;
            background-color: #fff;
            page-break-inside: avoid;
        }
        .report-card-title {
            font-size: 11pt;
            font-weight: bold;
            color: #0f172a;
            border-bottom: 1px solid #e2e8f0;
            padding-bottom: 5px;
            margin-bottom: 8px;
        }
        .report-card-col {
            border: 1px dashed #cbd5e1;
            border-radius: 4px;
            background-color: #f8fafc;
            padding: 8px;
            min-height: 80px;
        }
        .report-card-field {
            margin-bottom: 6px;
        }
        .report-card-field-label {
            font-size: 7.5pt;
            font-weight: bold;
            color: #64748b;
            text-transform: uppercase;
        }
        .report-card-field-value {
            font-size: 9pt;
            color: #1e293b;
        }
    </style>
</head>
<body>
    <h1>{{ $reportName }}</h1>
    
    <div class="report-meta">
        <table style="width: 100%; margin: 0; border: none;">
            <tr style="border: none;">
                <td style="border: none; padding: 0; color: #64748b; font-size: 9pt;">
                    <strong>Généré le :</strong> {{ now()->format('d/m/Y') }}
                </td>
                <td style="border: none; padding: 0; text-align: right; color: #64748b; font-size: 9pt;">
                    <strong>Format :</strong> PDF Officiel HAP
                </td>
            </tr>
        </table>
    </div>

    @foreach ($groups as $group)
        <div class="group-section">
            @if ($group['key'])
                <div class="group-header">{{ $groupBy }} : {{ $group['key'] }} ({{ count($group['records']) }})</div>
            @endif
            @if (!($layout['show_headers_only'] ?? false))
                @if ($view && isset($view->config['columns']))
                    @foreach ($group['records'] as $rec)
                        @php
                            $titleField = $view->table->fields->first(fn($f) => ($f->options['is_title'] ?? false) || $f->type === 'title');
                            $titleVal = null;
                            if ($titleField) {
                                foreach ($rec as $k => $v) {
                                    if (strcasecmp($k, $titleField->name) === 0) {
                                        $titleVal = $v;
                                        break;
                                    }
                                }
                            }
                            $columnsLayout = $view->config['columns'];
                            $colCount = count($columnsLayout);
                            $colWidth = $colCount > 1 ? '48%' : '100%';
                        @endphp
                        <div class="report-card">
                            @if ($titleVal)
                                <div class="report-card-title">{{ $titleVal }}</div>
                            @endif
                            <table style="width: 100%; border: none; margin: 0; border-collapse: collapse;">
                                <tr style="border: none;">
                                    @foreach ($columnsLayout as $colFields)
                                        <td style="width: {{ $colWidth }}; vertical-align: top; border: none; padding: 0 10px 0 0;">
                                            <div class="report-card-col">
                                                @foreach ($colFields as $fId)
                                                    @php
                                                        $cleanId = str_starts_with($fId, 'draft-') ? substr($fId, 6) : $fId;
                                                        $fieldDef = $view->table->fields->first(fn($f) => $f->id === $cleanId);
                                                    @endphp
                                                    @if ($fieldDef && $fieldDef->type !== 'title')
                                                        @php
                                                            $fieldVal = null;
                                                            foreach ($rec as $k => $v) {
                                                                if (strcasecmp($k, $fieldDef->name) === 0) {
                                                                    $fieldVal = $v;
                                                                    break;
                                                                }
                                                            }
                                                        @endphp
                                                        <div class="report-card-field">
                                                            <div class="report-card-field-label">{{ $fieldDef->name }}</div>
                                                            <div class="report-card-field-value">
                                                                @if (is_array($fieldVal))
                                                                    {{ implode(', ', $fieldVal) }}
                                                                @else
                                                                    {{ $fieldVal ?? '-' }}
                                                                @endif
                                                            </div>
                                                        </div>
                                                    @endif
                                                @endforeach
                                            </div>
                                        </td>
                                    @endforeach
                                </tr>
                            </table>
                        </div>
                    @endforeach
                @else
                    <table class="report-table">
                        <thead>
                            <tr>
                                @foreach ($columns as $col)
                                    <th>{{ $col }}</th>
                                @endforeach
                            </tr>
                        </thead>
                        <tbody>
                            @if (empty($group['records']))
                                <tr>
                                    <td colspan="{{ count($columns) }}" style="text-align: center; color: #999;">Aucune fiche</td>
                                </tr>
                            @else
                                @foreach ($group['records'] as $rec)
                                    <tr>
                                        @foreach ($columns as $col)
                                            <td>
                                                @if (is_array($rec[$col] ?? null))
                                                    {{ implode(', ', $rec[$col]) }}
                                                @else
                                                    {{ $rec[$col] ?? '-' }}
                                                @endif
                                            </td>
                                        @endforeach
                                    </tr>
                                @endforeach
                            @endif
                        </tbody>
                    </table>
                @endif
            @endif
        </div>
    @endforeach
</body>
</html>
