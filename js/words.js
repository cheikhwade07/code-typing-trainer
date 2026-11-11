// Words mode content: keybr-style letter unlocking with everyday and AI/ML words.
// All sentences below are original, written for this app (not copied from papers).
(function () {
  const CTT = (window.CTT = window.CTT || {});

  // English letter frequency order; the first START letters are unlocked at once so
  // real words work from the first lesson.
  const ORDER = 'etaoinsrhldcumfpgwybvkxjqz'.split('');
  const START = 10;

  const COMMON = `the of and to in is it that was for on are with as his they be at one have this from
or had by not word but what some we can out other were all there when up use your how said an each
she which do their time if will way about many then them write would like so these her long make thing
see him two has look more day could go come did number sound no most people my over know water than
call first who may down side been now find any new work part take get place made live where after back
little only round man year came show every good me give our under name very through just form sentence
great think say help low line turn cause much mean before move right boy old too same tell does
set three want air well also play small end put home read hand large spell add even land here must
big high such follow act why ask men change went light kind off need house picture try us again animal
point mother world near build self earth father head stand own page should country found answer school
grow study still learn plant cover food sun four between state keep eye never last let thought city tree
cross farm hard start might story saw far sea draw left late run while press close night real life few
north open seem together next white children begin got walk example ease paper group always music those
both mark often letter until mile river car feet care second book carry took science eat room friend
began idea fish mountain stop once base hear horse cut sure watch color face wood main enough plain girl
usual young ready above ever red list though feel talk bird soon body dog family direct leave song
measure door product black short class wind question happen complete ship area half rock order
fire south problem piece told knew pass since top whole king space heard best hour better true during
hundred five remember step early hold west ground interest reach fast sing listen six table travel
less morning ten simple several toward war lay against pattern slow center love person money serve
appear road map rain rule pull cold notice voice unit power town fine certain fly fall lead cry
dark machine note wait plan figure star box field rest correct able pound done beauty drive stood
contain front teach week final gave green quick develop ocean warm free minute strong special mind
behind clear tail produce fact street inch multiply nothing course stay wheel full force blue object
decide surface deep moon island foot system busy test record boat common gold possible plane dry
wonder laugh thousand ago ran check game shape hot miss brought heat snow tire bring yes distant
fill east paint language among`;

const ML = `attention transformer token tokens layer layers model models train training trained test
loss gradient gradients tensor tensors vector vectors matrix weight weights bias neuron neural network
networks encoder decoder embedding embeddings softmax dropout batch batches epoch epochs learning rate
optimizer momentum inference sample samples dataset data label labels feature features input inputs
output outputs hidden state states sequence sequences position positional head heads query key value
keys values score scores scale normal norm residual linear activation sigmoid relu kernel convolution
filter pooling stride channel channels pixel image images text language speech signal noise prior
posterior likelihood probability random variance mean median metric metrics accuracy precision recall
error errors cost objective function functions parameter parameters estimate estimator regression
classifier classification cluster clustering tree forest boost boosting margin support graph node
nodes edge edges path search beam greedy decode decoding generate generation prompt context window
memory cache retrieval index agent agents reward policy action actions environment episode explore
learner teacher student distill transfer domain shift robust benchmark baseline ablation scaling
compute hardware parallel latent space diffusion denoise variational autoencoder contrastive pretrain
finetune adapter alignment evaluation evaluate inference deploy serve server pipeline stream online
offline split fold validation overfit underfit regular regularize sparse dense mixture expert experts
routing chunk chunks retrieve ranker rank ranking corpus vocabulary subword merge entropy cross
divergence logits logit argmax temperature nucleus sampling
adjust jitter project projection majority subject jacobian joint judge job jump journal major
zero size optimize normalize tokenize quantize quantized zone lazy maximize minimize visualize
quality quantity frequency unique equal require request question quick quiet quote query queue
extra exact explain example expert complex index approximate box mix
vocabulary verify vision evolve valid value`;

  const SENTENCES = [
    'The encoder reads the whole input before the decoder writes a single token.',
    'Each attention head learns to look at a different part of the sequence.',
    'We scale the dot products so the softmax does not saturate.',
    'Residual connections let the gradient flow through many layers.',
    'Dropout turns off random units during training to reduce overfitting.',
    'A larger batch gives a smoother gradient but uses more memory.',
    'The learning rate warms up slowly and then decays over time.',
    'Positional signals tell the model where each token sits in the sentence.',
    'The loss on the validation split stopped falling after the third epoch.',
    'We report the mean and the variance over five random seeds.',
    'An ablation shows which part of the model actually matters.',
    'The baseline is simple, but it is surprisingly hard to beat.',
    'Retrieval adds fresh context that the model never saw in training.',
    'A short prompt can change the behavior of a large language model.',
    'Beam search keeps several partial answers and extends the best ones.',
    'Greedy decoding is fast, but it can miss a better sequence.',
    'Temperature controls how random the sampled tokens are.',
    'The embedding table maps every token to a dense vector.',
    'Layer normalization keeps the activations in a stable range.',
    'The optimizer keeps a running average of past gradients.',
    'Weight decay pulls large parameters back toward zero.',
    'A confusion matrix shows which classes the classifier mixes up.',
    'Precision asks how many predicted positives were right.',
    'Recall asks how many real positives the model found.',
    'Cross entropy measures how far the prediction is from the label.',
    'The model overfits when it memorizes the training set.',
    'More data often helps more than a bigger model.',
    'We freeze the encoder and finetune only the last layer.',
    'A small adapter can specialize a large model for a new task.',
    'Distillation trains a small student to copy a large teacher.',
    'Contrastive learning pulls similar pairs together and pushes others apart.',
    'The latent space places similar inputs close to each other.',
    'Diffusion models learn to remove noise one small step at a time.',
    'An autoencoder compresses the input and then rebuilds it.',
    'The reward tells the agent how good its last action was.',
    'The policy maps each state of the environment to an action.',
    'Exploration helps the agent find rewards it has never seen.',
    'Sparse experts let each token use only part of the network.',
    'A router decides which expert should process each token.',
    'Caching past keys and values makes decoding much faster.',
    'Long contexts cost more memory because attention grows with length.',
    'We split long documents into chunks before indexing them.',
    'The ranker sorts the retrieved passages by relevance.',
    'A held out test set gives an honest estimate of real accuracy.',
    'Cross validation reuses the data by rotating the test fold.',
    'Gradient clipping stops a single bad batch from ruining training.',
    'Mixed precision training uses less memory and runs faster.',
    'Data parallel training copies the model to every device.',
    'The scaling curve shows loss falling as compute grows.',
    'Evaluation should match the way the model will be used.',
    'A robust model keeps working when the input distribution shifts.',
    'Label noise makes even a perfect model look worse than it is.',
    'Feature scaling helps gradient descent converge faster.',
    'A decision tree splits the data on one feature at a time.',
    'A random forest averages many trees to reduce variance.',
    'Boosting adds weak learners that fix the errors of earlier ones.',
    'Support vector machines look for the widest possible margin.',
    'Clustering groups points without using any labels.',
    'Regularization trades a little bias for much lower variance.',
    'The kernel trick lets a linear model learn curved boundaries.',
    'Convolution shares the same filter across every part of the image.',
    'Pooling reduces the size of the feature map.',
    'A stride of two halves the width and the height.',
    'Graph networks pass messages along the edges between nodes.',
    'The tokenizer breaks rare words into smaller subword pieces.',
    'A bigger vocabulary means shorter sequences but a larger embedding table.',
    'Perplexity is lower when the model is less surprised by the text.',
    'The logits become probabilities after the softmax.',
    'Argmax picks the single most likely class.',
    'Nucleus sampling keeps only the smallest set of likely tokens.',
    'Alignment work tries to make models helpful and honest.',
    'Benchmarks age quickly once models are trained on similar data.',
    'A careful error analysis often beats another round of tuning.',
    'Start with a simple model and add complexity only when it helps.',
    'Log every experiment so a result can be reproduced later.',
    'Check the data pipeline before blaming the model.',
    'Plot the training curve; numbers alone can hide a problem.',
    'Inference cost matters as much as accuracy in production.',
    'Online evaluation shows how the model behaves with real users.',
    'A model is only as good as the data it learned from.',
    'Attention lets every token gather information from every other token.',
    'Multi head attention runs several attention functions in parallel.',
    'The feed forward block is applied to each position on its own.',
    'Masking stops the decoder from reading future tokens.',
    'Teacher forcing feeds the true previous token during training.',
    'The value vectors are mixed using the attention weights.',
    'Queries and keys decide how much each position attends to another.',
    'Pretraining on a large corpus gives the model broad knowledge.',
    'Finetuning on a small labeled set adapts it to one task.',
    'A good metric rewards what we actually care about.',
    'Early stopping ends training when validation loss rises again.',
    'Batch normalization uses statistics from the current batch.',
    'The hidden state carries information from earlier steps.',
    'Vanishing gradients made deep recurrent networks hard to train.',
    'Skip connections made very deep networks practical.',
    'Variance across seeds can be larger than the gain we report.',
    'Every chart should say what the axes mean.',
    'Small, clean experiments teach more than one huge run.',
    'Read the error before you change the code.',
    'Ship the simple version first, then measure what to improve.',
  ];

  const WORDS = [...new Set((COMMON + ' ' + ML).split(/\s+/).filter((w) => /^[a-z]+$/.test(w)))];

  function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  // Lesson text. unlocked: letters allowed; plan: { focus, secondary } from ENGINE.plan;
  // length: target characters; sentences: true for a sentence lesson (all letters unlocked).
  function text(unlocked, plan, length, sentences) {
    length = Math.max(20, length || 70);
    if (sentences) {
      const out = [];
      let size = 0;
      let guard = 0;
      while (size < length && guard++ < 50) {
        const s = pick(SENTENCES);
        if (out.length && out[out.length - 1] === s) continue;
        out.push(s);
        size += s.length + 1;
      }
      return out.join(' ');
    }
    const set = new Set(unlocked);
    const usable = WORDS.filter((w) => [...w].every((c) => set.has(c)));
    const focus = plan && plan.focus;
    const withFocus = focus ? usable.filter((w) => w.includes(focus)) : [];
    const sec = ((plan && plan.secondary) || []).filter((c) => set.has(c));
    const withSec = sec.length ? usable.filter((w) => sec.some((c) => w.includes(c))) : [];
    const out = [];
    let size = 0;
    let guard = 0;
    while (size < length && guard++ < 500) {
      const r = Math.random();
      let pool = usable;
      if (withFocus.length && r < 0.5) pool = withFocus;
      else if (withSec.length && r < 0.8) pool = withSec;
      let w = pool.length ? pick(pool) : fakeWord(unlocked, focus);
      if (out.length && out[out.length - 1] === w) {
        if (pool.length < 2) w = fakeWord(unlocked, focus);
        else continue;
      }
      out.push(w);
      size += w.length + 1;
    }
    return out.join(' ');
  }

  // Fallback when no real word fits (should not happen with 10+ starting letters).
  function fakeWord(unlocked, focus) {
    const n = 3 + Math.floor(Math.random() * 3);
    let w = focus || '';
    while (w.length < n) w += pick(unlocked);
    return w;
  }

  CTT.WORDS = { ORDER, START, WORDS, SENTENCES, text };
})();
