async function handleQuestion(question) {
  console.log('Question:', question);
  const meta = await identifyMeta(question);
  console.log('Identified Meta:', meta);

  const { idLookupAxios, mainDataAxios } = await buildRapidApiCalls(meta);
  console.log('ID Lookup Axios:', idLookupAxios);
  console.log('Main Data Axios:', mainDataAxios);

  try {
    let resolvedIds = [];
    if (Array.isArray(idLookupAxios)) {
      for (const ax of idLookupAxios) {
        const result = await executeAxiosCommand(ax);
        const id = result?.id || result?.data?.[0]?.id || null;
        if (id) resolvedIds.push(id);
      }
    }

    let updatedMainAxios = mainDataAxios;
    resolvedIds.forEach((id, index) => {
      updatedMainAxios = updatedMainAxios.replace(new RegExp(`\{id${index + 1}\}`, 'g'), id);
    });

    const apiResult = await executeAxiosCommand(updatedMainAxios);
    console.log('API Result:', apiResult);

    const summary = await summarizeResult(question, apiResult);
    console.log('Summary:', summary);
    return summary;
  } catch (err) {
    console.error('Error during execution:', err);
    return 'Sorry, something went wrong while fetching the sports data.';
  }
}
