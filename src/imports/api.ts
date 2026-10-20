import { api, type Schemas } from '../api/client';
import { check, unwrap } from '../api/http';

export type Preview = Schemas['ImportPreviewResponse'];
export type PreviewOperation = Schemas['ImportOperation'];
export type OperationEdit = Schemas['OperationEdit'];
export type ImportResult = Schemas['ImportResult'];
export type Connection = Schemas['ConnectionResponse'];
export type SyncMode = NonNullable<Schemas['ScheduleRequest']['syncMode']>;
export type Schedule = Schemas['ScheduleRequest'];

// openapi-fetch serializes JSON by default; uploads go as multipart form data.
const multipart = (body?: { file: string }) => {
  const form = new FormData();
  if (body) form.append('file', body.file as unknown as Blob);
  return form;
};

export const previewPrivatBank = (file: File, accountId?: number): Promise<Preview> =>
  unwrap(
    api.POST('/api/v1/imports/privatbank/preview', {
      params: { query: { accountId } },
      body: { file: file as unknown as string },
      bodySerializer: multipart,
    }),
  );

export const previewZenMoneyToken = (token: string): Promise<Preview> =>
  unwrap(api.POST('/api/v1/imports/zenmoney/preview', { body: { token } }));

export const previewZenMoneyFile = (file: File): Promise<Preview> =>
  unwrap(
    api.POST('/api/v1/imports/zenmoney/file/preview', {
      body: { file: file as unknown as string },
      bodySerializer: multipart,
    }),
  );

export const previewPage = (id: string, page: number, size: number): Promise<Preview> =>
  unwrap(api.GET('/api/v1/imports/previews/{id}', { params: { path: { id }, query: { page, size } } }));

export const discardPreview = (id: string): Promise<void> =>
  check(api.DELETE('/api/v1/imports/previews/{id}', { params: { path: { id } } }));

export const confirmPreview = (id: string, operations: OperationEdit[]): Promise<ImportResult> =>
  unwrap(
    api.POST('/api/v1/imports/previews/{id}/confirm', { params: { path: { id } }, body: { operations } }),
  );

export type BrokerPreview = Schemas['BrokerPreviewResponse'];
export type BrokerOperation = Schemas['OperationPreview'];
export type BrokerTicker = Schemas['TickerPreview'];
export type InstrumentChoice = Schemas['InstrumentChoice'];
export type TickerChoice = Schemas['TickerChoice'];
export type BrokerImportResult = Schemas['BrokerImportResult'];

/** The trades and cash flows reports of Freedom Finance, in any order. */
export const previewFreedom = (files: File[], accountId?: number): Promise<BrokerPreview> =>
  unwrap(
    api.POST('/api/v1/imports/freedom/preview', {
      params: { query: { accountId } },
      body: { files: files as unknown as string[] },
      bodySerializer: (body) => {
        const form = new FormData();
        (body?.files ?? []).forEach((file) => form.append('files', file as unknown as Blob));
        return form;
      },
    }),
  );

export const confirmFreedom = (
  id: string,
  instruments: TickerChoice[],
  excluded: string[],
): Promise<BrokerImportResult> =>
  unwrap(
    api.POST('/api/v1/imports/freedom/previews/{id}/confirm', {
      params: { path: { id } },
      body: { instruments, excluded },
    }),
  );
