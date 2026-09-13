const _ = {
  get(obj: any, path: string) {
    return obj?.[path];
  },
};

export function one(obj: any) {
  return _.get(obj, 'a.b');
}

export function two(obj: any) {
  return _.get(obj, 'c');
}
