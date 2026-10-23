const stopwords=new Set('a o as os de do da dos das e é são está estão foi eram será ser estar isto isso esse essa este esta em no na nos nas para por com um uma uns umas que se ao aos à às the a an of in on to for and or is are this that how where what como onde qual quais pelo pela pelos pelas'.split(' '));
export function queryTerms(query,max=24){
  const terms=[...new Set(query.match(/[\p{L}\p{N}_]+/gu)??[])].slice(0,max);
  const filtered=terms.filter(term=>!stopwords.has(term.toLocaleLowerCase()));
  return filtered.length?filtered:terms;
}
