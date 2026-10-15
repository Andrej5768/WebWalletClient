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
