import http from 'k6/http';
import { check, sleep } from 'k6';

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
  });

  sleep(1);
}