import assert from 'node:assert/strict';
import test from 'node:test';
import { canViewVideo, type VideoAccessRecord } from '../src/services/videoAuthorization.js';

const linkedVideo: VideoAccessRecord = {
  uploaderId: 'candidate-1',
  report: {
    candidateId: 'candidate-1',
    videoPath: 'video.webm',
    jobProfile: { createdById: 'enterprise-1' },
  },
};

test('only the candidate, matching enterprise, and admin can view a linked video', () => {
  assert.equal(canViewVideo('CANDIDATE', 'candidate-1', 'video.webm', linkedVideo), true);
  assert.equal(canViewVideo('CANDIDATE', 'candidate-2', 'video.webm', linkedVideo), false);
  assert.equal(canViewVideo('ENTERPRISE', 'enterprise-1', 'video.webm', linkedVideo), true);
  assert.equal(canViewVideo('ENTERPRISE', 'enterprise-2', 'video.webm', linkedVideo), false);
  assert.equal(canViewVideo('ADMIN', 'admin-1', 'video.webm', linkedVideo), true);
});

test('unlinked, unknown, and mismatched uploads cannot grant access', () => {
  assert.equal(canViewVideo('CANDIDATE', 'candidate-1', 'video.webm', null), false);
  assert.equal(canViewVideo('CANDIDATE', 'candidate-1', 'video.webm', {
    uploaderId: 'candidate-1', report: null,
  }), false);
  assert.equal(canViewVideo('ENTERPRISE', 'enterprise-1', 'video.webm', {
    uploaderId: 'candidate-2', report: linkedVideo!.report,
  }), false);
  assert.equal(canViewVideo('ENTERPRISE', 'enterprise-1', 'video.webm', {
    uploaderId: 'candidate-1',
    report: { candidateId: 'candidate-1', videoPath: 'video.webm', jobProfile: null },
  }), false);
  assert.equal(canViewVideo('CANDIDATE', 'candidate-1', 'other.webm', linkedVideo), false);
  assert.equal(canViewVideo('ADMIN', 'admin-1', 'video.webm', null), true);
});
