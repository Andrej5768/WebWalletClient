import { api, type Schemas } from '../api/client';

export type Preview = Schemas['ImportPreviewResponse'];
export type PreviewOperation = Schemas['ImportOperation'];
export type OperationEdit = Schemas['OperationEdit'];
export type ImportResult = Schemas['ImportResult'];
export type Connection = Schemas['ConnectionResponse'];
export type SyncMode = NonNullable<Schemas['ScheduleRequest']['syncMode']>;
export type Schedule = Schemas['ScheduleRequest'];

function ok<T>({ data, error }: { data?: T; error?: unknown }): T {
  if (error !== undefined || data === undefined) throw error ?? new Error('Empty response');
  return data;
}

// openapi-fetch serializes JSON by default; uploads go as multipart form data.
const multipart = (body?: { file: string }) => {
  const form = new FormData();
  if (body) form.append('file', body.file as unknown as Blob);
  return form;
};

export async function previewPrivatBank(file: File, accountId?: number): Promise<Preview> {
  return ok(
    await api.POST('/api/v1/imports/privatbank/preview', {
      params: { query: { accountId } },
      body: { file: file as unknown as string },
      bodySerializer: multipart,
    }),
  );
}

export async function previewZenMoneyToken(token: string): Promise<Preview> {
  return ok(await api.POST('/api/v1/imports/zenmoney/preview', { body: { token } }));
}

export async function previewZenMoneyFile(file: File): Promise<Preview> {
  return ok(
    await api.POST('/api/v1/imports/zenmoney/file/preview', {
      body: { file: file as unknown as string },
      bodySerializer: multipart,
    }),
  );
}

export async function previewPage(id: string, page: number, size: number): Promise<Preview> {
  return ok(
    await api.GET('/api/v1/imports/previews/{id}', { params: { path: { id }, query: { page, size } } }),
  );
}

export async function discardPreview(id: string): Promise<void> {
  await api.DELETE('/api/v1/imports/previews/{id}', { params: { path: { id } } });
}

export async function confirmPreview(id: string, operations: OperationEdit[]): Promise<ImportResult> {
  return ok(
    await api.POST('/api/v1/imports/previews/{id}/confirm', {
      params: { path: { id } },
      body: { operations },
    }),
  );
}
