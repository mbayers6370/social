type EdgeRequest = Request & { cf?: { country?: string } };
declare const worker: {
  fetch(
    request: EdgeRequest,
    environment: { MARGIN_EDGE_SECRET?: string },
  ): Promise<Response>;
};
export default worker;
