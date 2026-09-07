// RedirectHub Load Test
// Tests the GET /:code redirect endpoint (the most critical path)
// Cache is pre-warmed before running so results reflect
// production steady-state performance (high cache hit ratio)

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');

export const options = {
  // Three stages: 100, 500, 2000 RPS
  // Using stages to ramp up gradually so we can see when things break
  scenarios: {
    load_100: {
      executor: 'constant-arrival-rate',
      rate: 100,
      timeUnit: '1s',
      duration: '30s',
      preAllocatedVUs: 50,
      maxVUs: 100,
      startTime: '0s',
      tags: { stage: '100rps' },
    },
    load_500: {
      executor: 'constant-arrival-rate',
      rate: 500,
      timeUnit: '1s',
      duration: '30s',
      preAllocatedVUs: 100,
      maxVUs: 200,
      startTime: '40s',
      tags: { stage: '500rps' },
    },
    load_2000: {
      executor: 'constant-arrival-rate',
      rate: 2000,
      timeUnit: '1s',
      duration: '30s',
      preAllocatedVUs: 200,
      maxVUs: 500,
      startTime: '80s',
      tags: { stage: '2000rps' },
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<500'],
    errors: ['rate<0.01'],
  },
};

// Test the redirect endpoint — this is the hot path
// redirects: 0 means k6 does NOT follow the redirect
// We check for 302 status to confirm redirect is returned
export default function () {
  // Rotate between three pre-warmed short codes
  // Change these to match your actual short codes
  const codes = ['2', '3', '4'];
  const code = codes[Math.floor(Math.random() * codes.length)];

  const res = http.get(`http://localhost:3000/${code}`, {
    redirects: 0,
  });

  const success = check(res, {
    'status is 302': (r) => r.status === 302,
    'response time < 200ms': (r) => r.timings.duration < 200,
  });

  // Add 0 for success, 1 for failure — called every iteration
  // so denominator = total requests, not just failures
  errorRate.add(!success);
}
