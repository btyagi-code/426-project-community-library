
// mock db for testing data
const catalog = [
  {
    title: 'The Great Gatsby',
    isbn: '9780743273565',
    branch: 'Downtown',
    format: 'physical',
    available_copies: 2,
  }, 
  {
    title: 'The Great Gatsby',
    isbn: '9780743273565',
    branch: 'North',
    format: 'digital',
    available_copies: 3,
  },
  {
    title: 'Beloved',
    isbn: '9781400033416',
    branch: 'East',
    format: 'physical',
    available_copies: 1,
  },
  {
    title: 'Educated',
    isbn: '9780399590504',
    branch: 'Downtown',
    format: 'digital',
    available_copies: 2,
  },
  {
    title: 'Dune',
    isbn: '9780441172719',
    branch: 'East',
    format: 'physical',
    available_copies: 2,
  },
  {
    title: 'Dune',
    isbn: '9780441172719',
    branch: 'North',
    format: 'physical',
    available_copies: 0,
  },
];

const format = (val) => {
  typeof val === 'string' ? val.trim() : '';
}

const delay = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });

function getLatency() {
  // 95% of operation complete between 30ms to 250ms
  if (Math.random() < 0.95) {
    return 30 + Math.random() * 220;
  }
  // 5% of operations execute slower between 300ms to 480ms, ensuring
  // the maximal margin is within the 500ms p95 SLO
  return 300 + Math.random() * 180;
}

export const checkout = async (input) => {
  const title = format(input.title); 
  const branch = format(input.branch);

  if (!title) {
    return {
      ok: false,
      status: 400,
      error: 'A title is required',
    }
  }

  if (!branch) {
    return {
      ok: false,
      status: 400,
      error: 'A branch is required',
    }
  }

  await delay(getLatency()); 

  const entry = catalog.find(
    (book) => 
      book.title.toLowerCase() === title.toLowerCase() &&
      book.branch.toLowerCase() === branch.toLowerCase()
  ); 

  if (!entry) {
    return {
      ok: false,
      status: 404,
      error: 'No matching book found at that branch',
    };
  }

  if (entry.available_copies <= 0) {
   	return {
      ok: false,
      status: 409,
      error: 'No available copies to loan at that branch',
    };
  }

  entry.available_copies -= 1;

  const loan = {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),

    title: entry.title,
    isbn: entry.isbn,
    branch: entry.branch,
    format: entry.format,
  };

  return {
    ok: true,
    loan,
  };
};