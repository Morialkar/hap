import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReportPrintPreview } from '../ReportPrintPreview';
import { render } from '../../test/render';

const documentHtml =
  '<html><head><style>.report-table{}</style></head><body><h1>Rapport</h1><table class="report-table"><tbody><tr><td>Tremblay</td></tr></tbody></table></body></html>';

describe('ReportPrintPreview', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue({ ok: true, text: async () => documentHtml });
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('renders the document the API produced for the PDF, not a local re-implementation', async () => {
    render(
      <ReportPrintPreview
        tableId="tbl-1"
        reportName="Rapport"
        query={{ select: ['Nom'] }}
        layout={{ view_id: 'view-1' }}
      />
    );

    const frame = (await screen.findByTestId('report-print-frame')) as HTMLIFrameElement;
    expect(frame.getAttribute('srcdoc')).toBe(documentHtml);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/v1/reports/preview/html');
    expect(init.method).toBe('POST');

    const body = JSON.parse(init.body);
    expect(body.table_id).toBe('tbl-1');
    expect(body.layout).toEqual({ view_id: 'view-1' });
  });

  it('prints the embedded document rather than the surrounding page', async () => {
    const user = userEvent.setup();
    render(<ReportPrintPreview tableId="tbl-1" reportName="Rapport" query={{}} layout={{}} />);

    const frame = (await screen.findByTestId('report-print-frame')) as HTMLIFrameElement;
    const framePrint = vi.fn();
    Object.defineProperty(frame, 'contentWindow', {
      value: { focus: vi.fn(), print: framePrint },
      configurable: true,
    });

    const pagePrint = vi.fn();
    window.print = pagePrint;

    await user.click(screen.getByRole('button', { name: /Print/i }));

    expect(framePrint).toHaveBeenCalledTimes(1);
    expect(pagePrint).not.toHaveBeenCalled();
  });

  it('reports a failure instead of showing a blank frame', async () => {
    fetchMock.mockResolvedValue({ ok: false });
    render(<ReportPrintPreview tableId="tbl-1" reportName="Rapport" query={{}} layout={{}} />);

    await waitFor(() => {
      expect(screen.getByText(/could not be loaded/i)).toBeInTheDocument();
    });
    expect(screen.queryByTestId('report-print-frame')).not.toBeInTheDocument();
  });
});
