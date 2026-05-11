let modelCache = {};

self.onmessage = async function (event) {
  const { type, payload, id } = event.data;

  try {
    switch (type) {
      case 'LOAD_MODEL':
        await handleLoadModel(payload, id);
        break;
      case 'RUN_INFERENCE':
        await handleInference(payload, id);
        break;
      case 'CHECK_MODEL':
        handleCheckModel(payload, id);
        break;
      case 'GET_EMBEDDING':
        await handleGetEmbedding(payload, id);
        break;
      default:
        self.postMessage({ type: 'ERROR', error: `Unknown type: ${type}`, id });
    }
  } catch (error) {
    self.postMessage({
      type: 'ERROR',
      error: error.message || 'Unknown worker error',
      id,
    });
  }
};

async function handleLoadModel({ modelName }, id) {
  self.postMessage({
    type: 'PROGRESS',
    status: 'loading',
    message: `Loading ${modelName}...`,
    progress: 0,
    id,
  });


  // Simulate model loading progress
  for (let i = 1; i <= 5; i++) {
    await new Promise((resolve) => setTimeout(resolve, 200));
    self.postMessage({
      type: 'PROGRESS',
      status: 'loading',
      message: `Loading ${modelName}...`,
      progress: i * 20,
      id,
    });
  }

  modelCache[modelName] = { loaded: true, name: modelName };

  self.postMessage({
    type: 'MODEL_LOADED',
    modelName,
    id,
  });
}

async function handleInference({ modelName, input }, id) {
  const model = modelCache[modelName];

  if (!model || !model.loaded) {
    throw new Error(`Model ${modelName} not loaded`);
  }

  // Placeholder for actual inference
  self.postMessage({
    type: 'PROGRESS',
    status: 'generating',
    message: 'Generating response...',
    progress: 0,
    id,
  });

  // Simulate streaming tokens
  const words = [
    'This',
    ' is',
    ' a',
    ' placeholder',
    ' response',
    ' from',
    ' the',
    ' local',
    ' AI',
    ' model.',
    ' In',
    ' Phase',
    ' 2,',
    ' this',
    ' will',
    ' be',
    ' real',
    ' inference!',
  ];

  for (let i = 0; i < words.length; i++) {
    await new Promise((resolve) => setTimeout(resolve, 50));
    self.postMessage({
      type: 'TOKEN',
      token: words[i],
      id,
    });
  }

  self.postMessage({
    type: 'INFERENCE_COMPLETE',
    id,
  });
}

function handleCheckModel({ modelName }, id) {
  const loaded = !!modelCache[modelName]?.loaded;
  self.postMessage({
    type: 'MODEL_STATUS',
    modelName,
    loaded,
    id,
  });
}

async function handleGetEmbedding({ text }, id) {
  // Placeholder for embedding generation 
  self.postMessage({
    type: 'EMBEDDING_RESULT',
    embedding: new Array(384).fill(0).map(() => Math.random()),
    id,
  });
}
