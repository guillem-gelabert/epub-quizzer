// GraphQL endpoint
const GRAPHQL_ENDPOINT = "/api/graphql";

/**
 * Execute a GraphQL query
 */
export async function graphqlQuery<T = any>(
  query: string,
  variables?: Record<string, any>
): Promise<T> {
  const response = await $fetch<{ data: T; errors?: any[] }>(GRAPHQL_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: {
      query,
      variables,
    },
  });

  if (response.errors) {
    throw new Error(`GraphQL errors: ${JSON.stringify(response.errors)}`);
  }

  return response.data;
}

/**
 * Execute a GraphQL mutation
 */
export async function graphqlMutation<T = any>(
  mutation: string,
  variables?: Record<string, any>
): Promise<T> {
  return graphqlQuery<T>(mutation, variables);
}

// Common queries
export const GET_BOOKS = `
  query GetBooks {
    books {
      id
      title
      author
      contentHash
      coverPath
      createdAt
    }
  }
`;

export const GET_BOOK = `
  query GetBook($id: ID!) {
    book(id: $id) {
      id
      title
      author
      contentHash
      toc
      sections {
        id
        sectionIndex
        href
        title
        html
      }
    }
  }
`;

export const GET_BOOK_TOC = `
  query GetBookToc($bookId: ID!) {
    bookToc(bookId: $bookId)
  }
`;

export const GET_CHUNKS = `
  query GetChunks($bookId: ID!, $from: Int, $limit: Int) {
    chunks(bookId: $bookId, from: $from, limit: $limit) {
      id
      chunkIndex
      text
      wordCount
      sectionIndex
    }
  }
`;

export const GET_PROGRESS = `
  query GetProgress($bookId: ID!) {
    progress(bookId: $bookId) {
      sessionId
      bookId
      currentChunkIndex
      unlockedUntilChunkIndex
      updatedAt
    }
  }
`;

export const GET_QUIZZES = `
  query GetQuizzes($bookId: ID!) {
    quizzes(bookId: $bookId) {
      id
      gateStartChunkIndex
      gateEndChunkIndex
      facts
      questions
      createdAt
    }
  }
`;

// Common mutations
export const CREATE_SESSION = `
  mutation CreateSession {
    createSession {
      id
      createdAt
    }
  }
`;

export const ADD_BOOK_TO_SESSION = `
  mutation AddBookToSession($bookId: ID!) {
    addBookToSession(bookId: $bookId) {
      sessionId
      bookId
      addedAt
    }
  }
`;

export const UPDATE_PROGRESS = `
  mutation UpdateProgress($input: UpdateProgressInput!) {
    updateProgress(input: $input) {
      sessionId
      bookId
      currentChunkIndex
      unlockedUntilChunkIndex
      updatedAt
    }
  }
`;

export const CREATE_QUIZ = `
  mutation CreateQuiz($input: CreateQuizInput!) {
    createQuiz(input: $input) {
      id
      gateStartChunkIndex
      gateEndChunkIndex
      facts
      questions
      createdAt
    }
  }
`;

export const SUBMIT_QUIZ_ATTEMPT = `
  mutation SubmitQuizAttempt($input: SubmitQuizAttemptInput!) {
    submitQuizAttempt(input: $input) {
      id
      correctCount
      passed
      answeredAt
    }
  }
`;

