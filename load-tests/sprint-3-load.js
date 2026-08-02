import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 10,
  duration: '30s',
  thresholds: {
    http_req_duration: ['p(95)<700'],
    http_req_failed: ['rate<0.01'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

const POPULAR_TITLES = ['Dune', 'Educated'];
const OTHER_TITLES = [
  'The Great Gatsby', 'Beloved', 'Circe', 'Atomic Habits',
  'Project Hail Mary', 'The Hobbit', 'Sapiens', 'Becoming',
  'The Alchemist', 'Where the Crawdads Sing', 'Klara and the Sun',
  'The Silent Patient', 'Born a Crime', 'The Vanishing Half',
  'Piranesi', 'Cloud Cuckoo Land', 'Demon Copperhead',
];

function pickTitle() {
  if (Math.random() < 0.5) {
    return POPULAR_TITLES[
      Math.floor(Math.random() * POPULAR_TITLES.length)
    ];
  }

  return OTHER_TITLES[
    Math.floor(Math.random() * OTHER_TITLES.length)
  ];
}

export default function () {
  const title = pickTitle();
  const url = `${BASE_URL}/availability?title=${encodeURIComponent(title)}`;

  const res = http.get(url);

  check(res, {
    'status is 200': (r) => r.status === 200,
    'response has branches array': (r) => {
      try {
        return Array.isArray(JSON.parse(r.body).branches);
      } catch (err) {
        return false;
      }
    },
  });

  sleep(1);
}