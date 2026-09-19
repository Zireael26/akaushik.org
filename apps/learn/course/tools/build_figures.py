from pathlib import Path
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import numpy as np
ROOT=Path(__file__).resolve().parents[1];out=ROOT/'visuals/plots';out.mkdir(exist_ok=True)
plt.rcParams.update({'font.family':'DejaVu Sans','font.size':11,'axes.spines.top':False,'axes.spines.right':False,'axes.labelcolor':'#243d35','text.color':'#243d35','axes.titleweight':'bold','figure.facecolor':'white'})
def save(fig,name):
 fig.savefig(out/(name+'.png'),dpi=180,bbox_inches='tight');fig.savefig(out/(name+'.svg'),bbox_inches='tight');plt.close(fig)
p=.8;k=np.arange(1,11);fig,ax=plt.subplots(figsize=(8.4,4.5));ax.plot(k,1-(1-p)**k,'o-',color='#247969',label='At least one success');ax.plot(k,p**k,'s-',color='#bc612f',label='Every attempt succeeds');ax.set(xlabel='Number of independent attempts',ylabel='Probability',ylim=(0,1.06),xticks=k,title='Capability and repeatability answer different questions');ax.grid(axis='y',alpha=.2);ax.legend(loc='center right');fig.subplots_adjust(bottom=.24);fig.text(.12,.03,'Illustrative model: fixed p = 0.8; independent attempts; no selection error.',fontsize=9);save(fig,'reliability')
n=np.arange(2,9);r=3;fig,ax=plt.subplots(figsize=(8.4,4.5));ax.plot(n,n,'o-',label='Parallel workers + one synthesis',color='#247969');ax.plot(n,2*n*r,'s-',label='Supervisor: dispatch + return each round',color='#4867a6');ax.plot(n,n*(n-1)*(r-1)+n,'^-',label='All-to-all discussion between rounds',color='#bc612f');ax.set(xlabel='Workers',ylabel='Message copies',xticks=n,title='Communication depends on the coordination contract');ax.grid(axis='y',alpha=.2);ax.legend(loc='upper left',fontsize=9);fig.subplots_adjust(bottom=.24);fig.text(.12,.03,'Three rounds; arithmetic model. Message length and useful information are separate quantities.',fontsize=9);save(fig,'communication')
fig,ax=plt.subplots(figsize=(8.4,4.5));jobs=np.arange(1,9);width=.35;ax.bar(jobs-width/2,jobs*10,width,label='1 worker',color='#6d8876');ax.bar(jobs+width/2,np.ceil(jobs/2)*10,width,label='2 workers',color='#b86437');ax.set(xlabel='Job in FIFO order',ylabel='Completion latency (seconds)',xticks=jobs,title='Queue waiting is part of user-visible latency');ax.legend();ax.grid(axis='y',alpha=.15);fig.subplots_adjust(bottom=.24);fig.text(.12,.03,'Eight arrivals at time zero; each job takes 10 seconds; no retries or other overhead.',fontsize=9);save(fig,'queue-latency')
print('Wrote three quantitative figures in PNG and SVG')
