const _ = {
  get(obj: any, path: string) {
    return obj?.[path];
  },
};

export function three(obj: any) {
  return _.get(obj, 'x');
}

export function ignored(obj: any) {
  // migration-ignore:lodash-get
  return _.get(obj, 'legacy-fixture');
}
