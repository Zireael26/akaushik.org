"""Inspectable optimization analogues, not implementations of GEPA or RLHF."""
import random
import math


def classify(text,policy):
    words=set(text.lower().replace('.','').split())
    if policy=='keyword':return 'urgent' in words
    if policy=='negation':return 'urgent' in words and not {'not','nonurgent'} & words
    if policy=='evidence':return 'urgent' in words and 'confirmed' in words and 'not' not in words
    raise ValueError('unknown policy')


def optimize(train,dev,holdout,budget=3):
    """Candidate selection uses dev; holdout is accessed once after freezing."""
    if not train or not dev or not holdout or not 1<=budget<=3:raise ValueError('nonempty splits and budget 1..3 required')
    identities=[{x['id'] for x in split} for split in (train,dev,holdout)]
    if any(identities[i]&identities[j] for i in range(3) for j in range(i+1,3)):
        raise ValueError('split leakage')
    # A fixed candidate menu isolates selection; it does not generate reflections.
    candidates=['keyword','negation','evidence'][:budget]
    history=[]
    for policy in candidates:
        train_score=sum(classify(x['text'],policy)==x['label'] for x in train)/len(train)
        dev_score=sum(classify(x['text'],policy)==x['label'] for x in dev)/len(dev)
        history.append({'policy':policy,'train':train_score,'dev':dev_score})
    winner=max(history,key=lambda x:x['dev'])['policy']
    score=sum(classify(x['text'],winner)==x['label'] for x in holdout)/len(holdout)
    return {'winner':winner,'history':history,'holdout_score':score,'holdout_evaluations':1,
            'scope':'finite policy search with a deterministic candidate menu; not GEPA performance'}


def bandit(seed=7,steps=200,epsilon=.15):
    """Toy online routing with observed binary reward minus action cost."""
    if not 0<=epsilon<=1 or steps<1:raise ValueError('invalid exploration settings')
    rng=random.Random(seed);counts=[0,0];means=[0.,0.];total=0.;trace=[]
    probabilities=[.65,.9];costs=[.05,.4]
    for step in range(steps):
        action=rng.randrange(2) if rng.random()<epsilon else max(range(2),key=lambda a:means[a])
        success=rng.random()<probabilities[action];reward=float(success)-costs[action]
        counts[action]+=1;means[action]+=(reward-means[action])/counts[action];total+=reward
        trace.append({'step':step,'action':action,'success':success,'reward':reward})
    return {'counts':counts,'estimated_value':means,'total_reward':total,'trace':trace,
            'true_expected_utilities':[probabilities[i]-costs[i] for i in range(2)],
            'scope':'stationary two-action simulation; no LLM training'}
