"""Optional live JSON chat adapter. No calls happen at import or by default."""
import json
import urllib.request
from urllib.parse import urlparse


class ChatAdapter:
    def __init__(self,base_url,model,api_key='',timeout=30):
        parsed=urlparse(base_url)
        local=parsed.hostname in {'localhost','127.0.0.1','::1'}
        if parsed.scheme!='https' and not (parsed.scheme=='http' and local):
            raise ValueError('HTTPS required except for local test servers')
        if parsed.username or parsed.password or parsed.query or parsed.fragment:
            raise ValueError('base URL must not embed credentials, query, or fragment')
        self.url=base_url.rstrip('/')+'/chat/completions'
        self.model,self.api_key,self.timeout=model,api_key,timeout

    def complete(self,messages,max_tokens=512):
        if type(max_tokens) is not int or max_tokens<1:raise ValueError('positive output limit required')
        payload={'model':self.model,'messages':messages,'max_tokens':max_tokens}
        headers={'Content-Type':'application/json'}
        if self.api_key:headers['Authorization']='Bearer '+self.api_key
        request=urllib.request.Request(self.url,data=json.dumps(payload).encode(),headers=headers,method='POST')
        with urllib.request.urlopen(request,timeout=self.timeout) as response:
            body=response.read(1_000_001)
        if len(body)>1_000_000:raise ValueError('response too large')
        data=json.loads(body)
        text=data['choices'][0]['message']['content']
        if not isinstance(text,str):raise ValueError('text content required')
        return {'text':text,'usage':data.get('usage'),'model':data.get('model',self.model)}
