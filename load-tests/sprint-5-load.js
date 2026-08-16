import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Trend } from 'k6/metrics';

const cacheHits = new Counter('cache_hits');
const cacheMisses = new Counter('cache_misses');
const cacheHitDuration = new Trend('cache_hit_duration', true);
const cacheMissDuration = new Trend('cache_miss_duration', true);

export const options = {
  vus: 10,
  duration: '60s',

  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<500'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

const titles = [
  'Dune',
  '1984',
  'The Hobbit',
  'Pride and Prejudice',
  'The Great Gatsby',
];

export default function () {
  const title =
    titles[Math.floor(Math.random() * titles.length)];

  const url =
    `${BASE_URL}/availability?title=${encodeURIComponent(title)}`;

  const response = http.get(url);

  check(response, {
    'status is 200': (r) => r.status === 200,
    'response has body': (r) => r.body && r.body.length > 0,
    'response has branches array': (r) => {
      try {
        return Array.isArray(JSON.parse(r.body).branches);
      } catch (err) {
        return false;
      }
    },
    'X-Cache has header': (r) => {
      return (r.headers['X-Cache'] === 'HIT' || r.headers['X-Cache'] === 'MISS');
    },
  });

  if (response.headers['X-Cache'] === 'HIT') {
    cacheHits.add(1); 
    cacheHitDuration.add(response.timings.duration);
  } 
  else if (response.headers['X-Cache'] === 'MISS') {
    cacheMisses.add(1);
    cacheMissDuration.add(response.timings.duration);
  }

  sleep(1);
}