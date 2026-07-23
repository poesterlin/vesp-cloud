import { beforeEach, describe, expect, mock, test } from 'bun:test';

const getJobStatus = mock();
const getBinaryBuffer = mock();

mock.module('$lib/utils/worker', () => ({ getJobStatus }));
mock.module('$lib/server/s3', () => ({ getBinaryBuffer }));

const { GET } = await import('./+server');

const request = (userId: string | null, jobId = 'job-1') =>
  GET({
    params: { jobId },
    locals: { user: userId ? { id: userId } : null },
  } as never);

beforeEach(() => {
  getJobStatus.mockReset();
  getBinaryBuffer.mockReset();
});

describe('GET /builds/[jobId].bin', () => {
  test('requires authentication before looking up the build', async () => {
    expect(request(null)).rejects.toMatchObject({ status: 401 });
    expect(getJobStatus).not.toHaveBeenCalled();
    expect(getBinaryBuffer).not.toHaveBeenCalled();
  });

  test('does not reveal builds owned by another user', async () => {
    getJobStatus.mockResolvedValue({
      id: 'job-1',
      userId: 'other-user',
      status: 'completed',
    });

    expect(request('user-1')).rejects.toMatchObject({ status: 404 });
    expect(getBinaryBuffer).not.toHaveBeenCalled();
  });

  test('does not serve incomplete builds', async () => {
    getJobStatus.mockResolvedValue({
      id: 'job-1',
      userId: 'user-1',
      status: 'running',
    });

    expect(request('user-1')).rejects.toMatchObject({ status: 404 });
    expect(getBinaryBuffer).not.toHaveBeenCalled();
  });

  test('serves a completed build to its owner', async () => {
    const binary = new Response('firmware');
    getJobStatus.mockResolvedValue({
      id: 'job-1',
      userId: 'user-1',
      status: 'completed',
    });
    getBinaryBuffer.mockResolvedValue(binary);

    expect(await request('user-1')).toBe(binary);
    expect(getBinaryBuffer).toHaveBeenCalledWith('job-1');
  });

  test('maps missing storage objects to a 404 response', async () => {
    getJobStatus.mockResolvedValue({
      id: 'job-1',
      userId: 'user-1',
      status: 'completed',
    });
    getBinaryBuffer.mockRejectedValue(new Error('missing'));

    const response = await request('user-1');
    expect(response.status).toBe(404);
  });
});
